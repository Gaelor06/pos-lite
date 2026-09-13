const inventarioModel = require('../models/inventarioModel');

function listar(req, res) {
    res.json(inventarioModel.obtenerInventario());
}

function listarMovimientos(req, res) {
    res.json(inventarioModel.obtenerMovimientos(req.query.limite || 80));
}

function registrarEntrada(req, res) {
    try {
        res.status(201).json(inventarioModel.registrarEntrada({ ...req.body, usuario_id: req.usuario.id }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

function registrarConversion(req, res) {
    try {
        res.status(201).json(inventarioModel.registrarConversion({ ...req.body, usuario_id: req.usuario.id }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = { listar, listarMovimientos, registrarEntrada, registrarConversion };