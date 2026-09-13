const authModel = require('../models/authModel');

function listar(req, res) {
    res.json(authModel.listarUsuarios());
}

function crear(req, res) {
    try { res.status(201).json(authModel.crearUsuario(req.body)); }
    catch (error) { res.status(400).json({ error: error.message }); }
}

function actualizar(req, res) {
    try {
        const usuario = authModel.actualizarUsuario(req.params.id, req.body);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(usuario);
    } catch (error) { res.status(400).json({ error: error.message }); }
}

function cambiarEstado(req, res) {
    try {
        const usuario = authModel.cambiarEstadoUsuario(req.params.id, req.body.activo);
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
        res.json(usuario);
    } catch (error) { res.status(400).json({ error: error.message }); }
}

module.exports = { listar, crear, actualizar, cambiarEstado };