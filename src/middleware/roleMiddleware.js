function requerirAdministrador(req, res, next) {
    if (!req.usuario || req.usuario.rol !== 'administrador') {
        return res.status(403).json({ error: 'Se requiere una cuenta administradora' });
    }
    next();
}

module.exports = { requerirAdministrador };