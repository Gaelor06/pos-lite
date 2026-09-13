const ventaModel = require('../models/ventaModel');

function crear(req, res) {
    try {
        const nuevaVenta = ventaModel.crear(req.body);
        res.status(201).json(nuevaVenta);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}
function listar(req, res) {
    const ventas = ventaModel.obtenerTodos();
    res.json(ventas);
}

function obtenerUno(req, res) {
    const venta = ventaModel.obtenerPorId(req.params.id);

    if (!venta) {
        return res.status(404).json({ error: 'Venta no encontrada' });
    }
    res.json(venta);
}

module.exports = { crear, listar, obtenerUno };