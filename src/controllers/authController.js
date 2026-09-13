const authModel = require('../models/authModel');
const { obtenerToken } = require('../middleware/authMiddleware');

function usuariosAcceso(req, res) {
    res.json(authModel.obtenerUsuariosAcceso());
}

function iniciarSesion(req, res) {
    const resultado = authModel.iniciarSesion(req.body.usuario, req.body.password);
    if (!resultado) return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
    res.setHeader('Set-Cookie', `poslite_sesion=${encodeURIComponent(resultado.token)}; Max-Age=43200; HttpOnly; SameSite=Lax; Path=/`);
    res.json({ usuario: resultado.usuario });
}

function sesionActual(req, res) {
    res.json({ usuario: req.usuario });
}

function iniciarSesionSeleccion(req, res) {
    const resultado = authModel.iniciarSesionPorId(req.body.id, req.body.password);
    if (!resultado) return res.status(401).json({ error: 'PIN incorrecto' });
    res.setHeader('Set-Cookie', `poslite_sesion=${encodeURIComponent(resultado.token)}; Max-Age=43200; HttpOnly; SameSite=Lax; Path=/`);
    res.json({ usuario: resultado.usuario });
}

function cerrarSesion(req, res) {
    authModel.cerrarSesion(obtenerToken(req));
    res.setHeader('Set-Cookie', 'poslite_sesion=; Max-Age=0; HttpOnly; SameSite=Lax; Path=/');
    res.json({ mensaje: 'Sesión cerrada' });
}

module.exports = { usuariosAcceso, iniciarSesion, iniciarSesionSeleccion, sesionActual, cerrarSesion };