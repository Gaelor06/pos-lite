const cajaModel = require('../models/cajaModel');

function estado(req, res) {
    res.json(cajaModel.estadoActual());
}

function historial(req, res) {
    res.json(cajaModel.obtenerHistorial());
}

function abrir(req, res) {
    try {
        res.status(201).json(cajaModel.abrir({ ...req.body, usuario_id: req.usuario.id }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

function cerrar(req, res) {
    try {
        res.json(cajaModel.cerrar({ ...req.body, usuario_id: req.usuario.id }));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = { estado, historial, abrir, cerrar };