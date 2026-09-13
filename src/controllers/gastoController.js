const gastoModel = require('../models/gastoModel');

function listar(req, res) {
    res.json(gastoModel.obtenerTodos());
}

function resumen(req, res) {
    res.json(gastoModel.obtenerResumen());
}

function crear(req, res) {
    try {
        res.status(201).json(gastoModel.crear({ ...req.body, usuario_id: req.usuario.id }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = { listar, resumen, crear };