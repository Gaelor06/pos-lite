const db = require('../../database/db');

function obtenerInventario() {
    return db.prepare(`
        SELECT p.id, p.nombre, p.unidad_venta, p.controla_inventario, p.stock_minimo,
               COALESCE(sa.cantidad_disponible, 0) AS cantidad_disponible
        FROM productos p
        LEFT JOIN stock_actual sa ON sa.producto_id = p.id
        WHERE p.activo = 1
        ORDER BY p.nombre COLLATE NOCASE
    `).all();
}

function obtenerMovimientos(limite = 80) {
    const limiteSeguro = Math.min(Math.max(Number.parseInt(limite, 10) || 80, 1), 500);
    return db.prepare(`
        SELECT im.id, im.producto_id, p.nombre AS producto_nombre, p.unidad_venta,
               im.tipo, im.cantidad, im.nota, im.creado_en
        FROM inventario_movimientos im
        JOIN productos p ON p.id = im.producto_id
        ORDER BY im.id DESC
        LIMIT ?
    `).all(limiteSeguro);
}

function convertirCantidad(producto, cantidad) {
    const valor = Number(cantidad);
    if (!Number.isFinite(valor) || valor <= 0) {
        throw new Error('La cantidad debe ser mayor que cero');
    }
    if (producto.unidad_venta === 'unidad' && !Number.isInteger(valor)) {
        throw new Error(`La cantidad de "${producto.nombre}" debe ser un número entero`);
    }
    return Math.round(valor * (producto.unidad_venta === 'kg' ? 1000 : 1));
}

function obtenerProducto(productoId) {
    const producto = db.prepare(
        'SELECT * FROM productos WHERE id = ? AND activo = 1'
    ).get(Number(productoId));
    if (!producto) throw new Error('El producto no existe o está inactivo');
    return producto;
}

function validarUsuario(usuarioId) {
    const idSolicitado = Number(usuarioId);
    const id = idSolicitado > 0
        ? idSolicitado
        : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1').get()?.id;
    const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(id);
    if (!usuario) throw new Error('El usuario no es válido');
    return id;
}

function registrarEntrada({ producto_id, cantidad, nota, usuario_id }) {
    const producto = obtenerProducto(producto_id);
    if (!producto.controla_inventario) {
        throw new Error(`"${producto.nombre}" está configurado sin control de inventario`);
    }
    const cantidadBase = convertirCantidad(producto, cantidad);
    const usuarioId = validarUsuario(usuario_id);

    const resultado = db.prepare(`
        INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id)
        VALUES (?, 'entrada', ?, ?, ?)
    `).run(producto.id, cantidadBase, String(nota || '').trim() || null, usuarioId);

    return db.prepare(`
        SELECT im.*, p.nombre AS producto_nombre, p.unidad_venta
        FROM inventario_movimientos im
        JOIN productos p ON p.id = im.producto_id
        WHERE im.id = ?
    `).get(resultado.lastInsertRowid);
}

function registrarConversion({ producto_origen_id, cantidad_origen, producto_resultado_id, cantidad_resultado, nota, usuario_id }) {
    const origen = obtenerProducto(producto_origen_id);
    if (!origen.controla_inventario) {
        throw new Error(`"${origen.nombre}" está configurado sin control de inventario`);
    }

    const cantidadOrigenBase = convertirCantidad(origen, cantidad_origen);
    const registroStock = db.prepare(`
        SELECT COALESCE(cantidad_disponible, 0) AS cantidad_disponible
        FROM stock_actual WHERE producto_id = ?
    `).get(origen.id);
    const stock = registroStock ? registroStock.cantidad_disponible : 0;
    if (stock < cantidadOrigenBase) {
        throw new Error(`No hay inventario suficiente de "${origen.nombre}"`);
    }

    let resultado = null;
    if (producto_resultado_id) {
        const productoResultado = obtenerProducto(producto_resultado_id);
        if (Number(productoResultado.id) === Number(origen.id)) {
            throw new Error('El producto de origen y resultado deben ser distintos');
        }
        if (productoResultado.controla_inventario && (cantidad_resultado === undefined || cantidad_resultado === null || cantidad_resultado === '')) {
            throw new Error('Indica la cantidad resultante para el producto que controla inventario');
        }
        if (productoResultado.controla_inventario) {
            resultado = {
                producto: productoResultado,
                cantidadBase: convertirCantidad(productoResultado, cantidad_resultado)
            };
        }
    }

    const usuarioId = validarUsuario(usuario_id);
    const notaBase = String(nota || '').trim();
    const notaConsumo = resultado
        ? `${notaBase ? `${notaBase} — ` : ''}Conversión a ${resultado.producto.nombre}`
        : `${notaBase ? `${notaBase} — ` : ''}Conversión / preparación`;

    const ejecutar = db.transaction(() => {
        db.prepare(`
            INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id)
            VALUES (?, 'consumo_interno', ?, ?, ?)
        `).run(origen.id, -cantidadOrigenBase, notaConsumo, usuarioId);

        if (resultado) {
            db.prepare(`
                INSERT INTO inventario_movimientos (producto_id, tipo, cantidad, nota, usuario_id)
                VALUES (?, 'entrada', ?, ?, ?)
            `).run(resultado.producto.id, resultado.cantidadBase, `Resultado de conversión desde ${origen.nombre}`, usuarioId);
        }
    });
    ejecutar();
    return { mensaje: 'Conversión registrada' };
}

module.exports = { obtenerInventario, obtenerMovimientos, registrarEntrada, registrarConversion };