const db = require('../../database/db');


// function es para delcarar metodos, aca en js no se tiene ni que declarar tipo de retorno ni parametros

function obtenerTodos() {
 // aca se hace la consulta a la base de datos, se usa el metodo prepare para preparar la consulta y luego se ejecuta con all()
 //  para obtener todos las filas como un array
    return db.prepare('SELECT * FROM productos WHERE activo = 1').all();
}

function obtenerPorId(id) {
    // .get() se usa para obtener un registro, en este caso se obtiene el producto
    // con el id especificado
    // el ? es un placeholder para el parametro que se pasa a la consulta, en este caso el id
    return db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
    }

function crear(producto) {

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

function actualizarPrecio(id, nuevoPrecio) {
    const resultado = db.prepare(
        `UPDATE productos SET precio_venta = ? WHERE id = ?`
    ).run(
        nuevoPrecio,
        id
    );

    return resultado.changes > 0; // Devuelve true si se actualizó algún registro
}

function actualizarGeneral(id, producto) {
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

module.exports = { obtenerTodos, obtenerPorId, crear, actualizarPrecio, actualizarGeneral, cambiarEstadoActivo, cambiarUnidadVenta };
