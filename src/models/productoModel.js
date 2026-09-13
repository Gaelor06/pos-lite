const db = require('../../database/db');


function obtenerTodos() {
    return db.prepare(`
        SELECT * FROM productos
        ORDER BY activo DESC, nombre COLLATE NOCASE
    `).all();
}

function obtenerPorId(id) {
    // .get() se usa para obtener un registro, en este caso se obtiene el producto
    // con el id especificado
    // el ? es un placeholder para el parametro que se pasa a la consulta, en este caso el id
    return db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    }

function crear(producto) {
    validarProducto(producto);

    // "producto" aquí es un objeto JS, algo así como: { nombre: "Pargo", categoria_id: 1, ... }
    // Puedes acceder a sus propiedades con punto: producto.nombre, producto.precio_venta, etc.
    const resultado = db.prepare(`
        INSERT INTO productos
         (nombre, categoria_id, unidad_venta, precio_costo, precio_venta, controla_inventario, stock_minimo)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
        producto.nombre,
        producto.categoria_id,
        producto.unidad_venta,
        producto.precio_costo,
        producto.precio_venta,
        producto.controla_inventario,
        producto.stock_minimo
    );
     
    // .run() devuelve info de la operacion, como el id del registro
    
    return obtenerPorId(resultado.lastInsertRowid); // Devuelve el producto recién creado
}

function validarProducto(producto) {
    const nombre = String(producto.nombre || '').trim();
    const categoriaId = Number(producto.categoria_id);
    const unidadVenta = String(producto.unidad_venta || '');
    const precioCosto = Number(producto.precio_costo);
    const precioVenta = Number(producto.precio_venta);
    const stockMinimo = Number(producto.stock_minimo);

    if (!nombre) throw new Error('El nombre del producto es obligatorio');
    if (!Number.isInteger(categoriaId) || categoriaId <= 0 || !db.prepare('SELECT id FROM categorias WHERE id = ?').get(categoriaId)) {
        throw new Error('La categoría del producto no es válida');
    }
    if (!['kg', 'unidad'].includes(unidadVenta)) throw new Error('La unidad de venta no es válida');
    if (!Number.isInteger(precioCosto) || precioCosto < 0) throw new Error('El precio de costo no es válido');
    if (!Number.isInteger(precioVenta) || precioVenta < 0) throw new Error('El precio de venta no es válido');
    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) throw new Error('El stock mínimo no es válido');
}

function usuarioActivo(usuarioId) {
    const solicitado = Number(usuarioId);
    const idUsuario = solicitado > 0
        ? solicitado
        : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1').get()?.id;
    if (!db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(idUsuario)) {
        throw new Error('El usuario no es válido');
    }
    return idUsuario;
}

function actualizarPrecio(id, nuevoPrecio, motivo, usuarioId) {
    if (!Number.isInteger(Number(nuevoPrecio)) || Number(nuevoPrecio) < 0) {
        throw new Error('El precio de venta no es válido');
    }
    const motivoLimpio = String(motivo || '').trim();
    if (!motivoLimpio) throw new Error('El motivo del cambio de precio es obligatorio');

    const producto = obtenerPorId(id);
    if (!producto) return false;
    const usuario = usuarioActivo(usuarioId);
    const ejecutar = db.transaction(() => {
        db.prepare('UPDATE productos SET precio_venta = ? WHERE id = ?').run(Number(nuevoPrecio), id);
        db.prepare(`
            INSERT INTO productos_historial_precios
                (producto_id, precio_anterior, precio_nuevo, motivo, usuario_id)
            VALUES (?, ?, ?, ?, ?)
        `).run(id, producto.precio_venta, Number(nuevoPrecio), motivoLimpio, usuario);
    });
    ejecutar();

    return true;
}

function obtenerHistorialPrecios(productoId) {
    return db.prepare(`
        SELECT h.*, u.nombre AS usuario_nombre
        FROM productos_historial_precios h
        JOIN usuarios u ON u.id = h.usuario_id
        WHERE h.producto_id = ?
        ORDER BY h.id DESC
    `).all(productoId);
}

function actualizarGeneral(id, producto) {
    validarProducto({
        ...producto,
        unidad_venta: obtenerPorId(id)?.unidad_venta
    });
    const resultado = db.prepare(
        `UPDATE productos SET nombre = ?, categoria_id = ?, precio_costo = ?, stock_minimo = ? WHERE id = ?`
    ).run(
        producto.nombre,
        producto.categoria_id,
        producto.precio_costo,
        producto.stock_minimo,
        id
        );
    
    return resultado.changes > 0; // Devuelve true si se actualizó algún registro
}

function cambiarEstadoActivo(id, nuevoEstado) {
    const valor = nuevoEstado ? 1 : 0; // Convertir booleano a entero (1 o 0)
    const resultado = db.prepare(
        `UPDATE productos SET activo = ? WHERE id = ?`
    ).run(
        valor,
        id);

    return resultado.changes > 0; // Devuelve true si se actualizó algún registro
}

function cambiarUnidadVenta(id, unidad_venta) {
    const tieneMovimientos = db.prepare(
        'SELECT COUNT(*) AS total FROM inventario_movimientos WHERE producto_id = ?'
    ).get(id).total;

    if (tieneMovimientos > 0) {
        throw new Error('No se puede cambiar la unidad de venta: este producto ya tiene movimientos de inventario registrados');
    }

    const resultado = db.prepare(
        `UPDATE productos SET unidad_venta = ? WHERE id = ?`
    ).run(unidad_venta, id);

    return resultado.changes > 0;
}

module.exports = { obtenerTodos, obtenerPorId, crear, actualizarPrecio, obtenerHistorialPrecios, actualizarGeneral, cambiarEstadoActivo, cambiarUnidadVenta };
