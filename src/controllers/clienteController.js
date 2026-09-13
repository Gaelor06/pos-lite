const clienteModel = require('../models/clienteModel');

function listar(req, res) {
    res.json(clienteModel.obtenerTodos());
}

function crear(req, res) {
    try {
        res.status(201).json(clienteModel.crear(req.body));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = { listar, crear };
