const db = require('../../database/db');
const clienteModel = require('./clienteModel');

// Redondea al múltiplo de ₡50 más cercano
function redondearA50(monto) {
    return Math.round(monto / 50) * 50;
}

// --- Consultas preparadas (igual que ya haces en otros models) ---
const obtenerProductoPorId = db.prepare('SELECT * FROM productos WHERE id = ?');

const insertarVenta = db.prepare(`
    INSERT INTO ventas (usuario_id, cliente_id, comprador_nombre, total_real, total_cobrado)
    VALUES (?, ?, ?, ?, ?)
`);

const insertarDetalle = db.prepare(`
    INSERT INTO venta_detalle
        (venta_id, producto_id, cantidad, precio_normal_unitario, precio_aplicado_unitario, motivo_precio_especial, subtotal)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const insertarMovimiento = db.prepare(`
    INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, referencia_venta_id, usuario_id)
    VALUES (?, 'venta', ?, ?, ?)
`);

const insertarPago = db.prepare(`
    INSERT INTO venta_pagos (venta_id, metodo_pago, monto)
    VALUES (?, ?, ?)
`);

const obtenerStock = db.prepare(`
    SELECT COALESCE(cantidad_disponible, 0) AS cantidad_disponible
    FROM stock_actual
    WHERE producto_id = ?
`);

function obtenerUsuarioActivo(usuarioId) {
    const idSolicitado = Number(usuarioId);
    const id = idSolicitado > 0
        ? idSolicitado
        : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1').get()?.id;
    const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(id);
    if (!usuario) throw new Error('El usuario de la venta no es válido');
    return id;
}

function prepararPagos(datos, totalCobrado) {
    const pagos = Array.isArray(datos.pagos) && datos.pagos.length > 0
        ? datos.pagos
        : [{ metodo_pago: datos.metodo_pago, monto: totalCobrado }];

    const pagosValidos = pagos.map(pago => ({
        metodo_pago: String(pago.metodo_pago || ''),
        monto: Number(pago.monto)
    }));
    if (pagosValidos.some(pago => !['efectivo', 'sinpe', 'tarjeta'].includes(pago.metodo_pago) || !Number.isInteger(pago.monto) || pago.monto <= 0)) {
        throw new Error('Cada pago debe tener un método válido y un monto entero mayor que cero');
    }
    const totalPagos = pagosValidos.reduce((total, pago) => total + pago.monto, 0);
    if (totalPagos !== totalCobrado) {
        throw new Error('La suma de los pagos debe coincidir con el total cobrado');
    }
    return pagosValidos;
}

function crearVentaTx(datos) {
    const usuarioId = obtenerUsuarioActivo(datos.usuario_id);
    if (!Array.isArray(datos.productos) || datos.productos.length === 0) {
        throw new Error('La venta debe incluir al menos un producto');
    }
    if (!['efectivo', 'sinpe', 'tarjeta'].includes(datos.metodo_pago)) {
        if (!Array.isArray(datos.pagos) || datos.pagos.length === 0) throw new Error('El método de pago no es válido');
    }
    const clienteId = datos.cliente_id ? Number(datos.cliente_id) : null;
    if (clienteId) {
        const cliente = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(clienteId);
        if (!cliente) throw new Error('El cliente no existe o está inactivo');
    }

    let totalReal = 0;
    const lineasProcesadas = [];

    for (const linea of datos.productos) {
        const cantidad = Number(linea.cantidad);
        const precioBase = Number(linea.precio_aplicado);

        if (!Number.isFinite(cantidad) || cantidad <= 0 ||
            !Number.isFinite(precioBase) || precioBase < 0) {
            throw new Error('La cantidad y el precio aplicado deben ser válidos');
        }

        const producto = obtenerProductoPorId.get(linea.producto_id);
        if (!producto) throw new Error(`El producto con id ${linea.producto_id} no existe`);
        if (!producto.activo) throw new Error(`El producto "${producto.nombre}" está desactivado`);

        const precioEspecial = clienteId ? clienteModel.obtenerPrecioEspecial(clienteId, producto.id) : null;
        const precioAplicado = precioEspecial !== null ? Number(precioEspecial) : precioBase;
        const motivoPrecioEspecial = precioEspecial !== null ? 'Precio especial cliente' : (linea.motivo_precio_especial || null);
        const subtotal = Math.round(cantidad * precioAplicado);
        const factor = producto.unidad_venta === 'kg' ? 1000 : 1;
        const cantidadBase = Math.round(cantidad * factor);

        if (producto.unidad_venta === 'unidad' && !Number.isInteger(cantidad)) {
            throw new Error(`La cantidad de "${producto.nombre}" debe ser un número entero`);
        }
        if (producto.controla_inventario) {
            const registroStock = obtenerStock.get(producto.id);
            const stock = registroStock ? registroStock.cantidad_disponible : 0;
            if (stock < cantidadBase) throw new Error(`No hay inventario suficiente de "${producto.nombre}"`);
        }

        lineasProcesadas.push({ producto, linea, subtotal, cantidadBase, precioAplicado, motivoPrecioEspecial });
        totalReal += subtotal;
    }

    const totalCobrado = redondearA50(totalReal);
    const pagos = prepararPagos(datos, totalCobrado);
    const compradorNombre = datos.comprador_nombre ? String(datos.comprador_nombre).trim() : null;
    const resultadoVenta = insertarVenta.run(usuarioId, clienteId, compradorNombre || null, totalReal, totalCobrado);
    const ventaId = resultadoVenta.lastInsertRowid;

    for (const { producto, linea, subtotal, cantidadBase, precioAplicado, motivoPrecioEspecial } of lineasProcesadas) {
        insertarDetalle.run(ventaId, producto.id, cantidadBase, producto.precio_venta,
            precioAplicado, motivoPrecioEspecial, subtotal);
        if (producto.controla_inventario) insertarMovimiento.run(producto.id, -cantidadBase, ventaId, usuarioId);
    }

    for (const pago of pagos) insertarPago.run(ventaId, pago.metodo_pago, pago.monto);
    return ventaId;
}

const crearVenta = db.transaction(crearVentaTx);

function crear(datos) {
    const ventaId = crearVenta(datos);
    return obtenerPorId(ventaId);
}

function obtenerPorId(id) {
    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(id);
    if (!venta) return null;

    venta.detalle = db.prepare(`
        SELECT vd.*, p.nombre AS producto_nombre, p.unidad_venta
        FROM venta_detalle vd
        JOIN productos p ON p.id = vd.producto_id
        WHERE vd.venta_id = ?
    `).all(id);

    venta.pagos = db.prepare('SELECT * FROM venta_pagos WHERE venta_id = ?').all(id);

    return venta;
}

function obtenerTodos() {
    return db.prepare(`
        SELECT v.*, c.nombre AS cliente_nombre
        FROM ventas v
        LEFT JOIN clientes c ON c.id = v.cliente_id
        ORDER BY v.fecha_hora DESC
        LIMIT 100
    `).all();
}

const cancelarQuery = db.prepare(`
    UPDATE ventas SET estado = 'cancelada', motivo_cancelacion = ?
    WHERE id = ? AND estado = 'completada'
`);

function cancelar(id, motivo) {
    const motivoLimpio = String(motivo || '').trim();
    if (!motivoLimpio) {
        throw new Error('El motivo de cancelación es obligatorio');
    }

    const venta = obtenerPorId(id);
    if (!venta) {
        throw new Error('La venta no existe');
    }
    if (venta.estado === 'cancelada') {
        throw new Error('Esta venta ya estaba cancelada');
    }

    // El UPDATE dispara el trigger trg_venta_cancelada_restaura_inventario,
    // que devuelve el stock automáticamente — no hay que hacerlo a mano aquí.
    cancelarQuery.run(motivoLimpio, id);

    return obtenerPorId(id);
}

module.exports = { crear, obtenerPorId, obtenerTodos, cancelar };