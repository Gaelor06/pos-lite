const db = require('../../database/db');

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

function crearVentaTx(datos) {
    if (!Number.isInteger(datos.usuario_id) || datos.usuario_id <= 0) {
        throw new Error('El usuario de la venta no es válido');
    }
    if (!Array.isArray(datos.productos) || datos.productos.length === 0) {
        throw new Error('La venta debe incluir al menos un producto');
    }
    if (!['efectivo', 'sinpe', 'tarjeta'].includes(datos.metodo_pago)) {
        throw new Error('El método de pago no es válido');
    }

    let totalReal = 0;
    const lineasProcesadas = [];

    for (const linea of datos.productos) {
        if (!Number.isFinite(linea.cantidad) || linea.cantidad <= 0 ||
            !Number.isFinite(linea.precio_aplicado) || linea.precio_aplicado < 0) {
            throw new Error('La cantidad y el precio aplicado deben ser válidos');
        }

        const producto = obtenerProductoPorId.get(linea.producto_id);
        if (!producto) throw new Error(`El producto con id ${linea.producto_id} no existe`);
        if (!producto.activo) throw new Error(`El producto "${producto.nombre}" está desactivado`);

        const subtotal = Math.round(linea.cantidad * linea.precio_aplicado);
        const factor = producto.unidad_venta === 'kg' ? 1000 : 1;
        const cantidadBase = Math.round(linea.cantidad * factor);

        if (producto.unidad_venta === 'unidad' && !Number.isInteger(linea.cantidad)) {
            throw new Error(`La cantidad de "${producto.nombre}" debe ser un número entero`);
        }
        if (producto.controla_inventario) {
            const registroStock = obtenerStock.get(producto.id);
            const stock = registroStock ? registroStock.cantidad_disponible : 0;
            if (stock < cantidadBase) throw new Error(`No hay inventario suficiente de "${producto.nombre}"`);
        }

        lineasProcesadas.push({ producto, linea, subtotal, cantidadBase });
        totalReal += subtotal;
    }

    const totalCobrado = redondearA50(totalReal);
    const compradorNombre = datos.comprador_nombre ? String(datos.comprador_nombre).trim() : null;
    const resultadoVenta = insertarVenta.run(datos.usuario_id, datos.cliente_id || null, compradorNombre || null, totalReal, totalCobrado);
    const ventaId = resultadoVenta.lastInsertRowid;

    for (const { producto, linea, subtotal, cantidadBase } of lineasProcesadas) {
        insertarDetalle.run(ventaId, producto.id, cantidadBase, producto.precio_venta,
            linea.precio_aplicado, linea.motivo_precio_especial || null, subtotal);
        if (producto.controla_inventario) insertarMovimiento.run(producto.id, -cantidadBase, ventaId, datos.usuario_id);
    }

    insertarPago.run(ventaId, datos.metodo_pago, totalCobrado);
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

module.exports = { crear, obtenerPorId, obtenerTodos };