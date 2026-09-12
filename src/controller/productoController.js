const productoModel = require('../models/productoModel');

function listar(req, res) {
    const productos = productoModel.obtenerTodos();
    res.json(productos);
}

function obtenerUno(req, res) {
    const producto = productoModel.obtenerPorId(req.params.id);

    if (!producto) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json(producto);
}

function crear(req, res) {
    const nuevoProducto = productoModel.crear(req.body);
    res.status(201).json(nuevoProducto);
}

function actualizarGeneral(req, res) {
    // req.params.id viene de la URL (ej. /api/productos/5 -> "5")
    // req.body trae los campos nuevos: { nombre, categoria_id, precio_costo, stock_minimo }
    const actualizado = productoModel.actualizarGeneral(req.params.id, req.body);

    if (!actualizado) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Producto actualizado' });
}

function actualizarPrecio(req, res) {
    // Esperamos: { "precio_venta": 4500 }
    const actualizado = productoModel.actualizarPrecio(req.params.id, req.body.precio_venta);

    if (!actualizado) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Precio actualizado' });
}

function cambiarEstadoActivo(req, res) {
    // Esperamos: { "activo": true }  o  { "activo": false }
    const actualizado = productoModel.cambiarEstadoActivo(req.params.id, req.body.activo);

    if (!actualizado) {
        return res.status(404).json({ error: 'Producto no encontrado' });
    }
    res.json({ mensaje: 'Estado actualizado' });
}

function cambiarUnidadVenta(req, res) {
    // Esperamos: { "unidad_venta": "kg" }  o  { "unidad_venta": "unidad" }
    // Esta función SÍ puede lanzar un error (throw) si el producto ya tiene movimientos,
    // así que hay que envolverla en try/catch — si no, ese error tumbaría el servidor entero.
    try {
        const actualizado = productoModel.cambiarUnidadVenta(req.params.id, req.body.unidad_venta);

        if (!actualizado) {
            return res.status(404).json({ error: 'Producto no encontrado' });
        }
        res.json({ mensaje: 'Unidad de venta actualizada' });
    } catch (error) {
        // 400 = "Bad Request": la petición está bien formada, pero la operación no es válida
        res.status(400).json({ error: error.message });
    }
}

module.exports = {
    listar,
    obtenerUno,
    crear,
    actualizarGeneral,
    actualizarPrecio,
    cambiarEstadoActivo,
    cambiarUnidadVenta
};