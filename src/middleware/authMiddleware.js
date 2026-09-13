const authModel = require('../models/authModel');

function obtenerToken(req) {
    const cookies = String(req.headers.cookie || '').split(';');
    const cookie = cookies.find(item => item.trim().startsWith('poslite_sesion='));
    return cookie ? decodeURIComponent(cookie.trim().slice('poslite_sesion='.length)) : null;
}

function requerirAutenticacion(req, res, next) {
    const usuario = authModel.obtenerSesion(obtenerToken(req));
    if (!usuario) return res.status(401).json({ error: 'Debes iniciar sesión' });
    req.usuario = usuario;
    next();
}

module.exports = { requerirAutenticacion, obtenerToken };