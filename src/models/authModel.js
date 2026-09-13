const crypto = require('crypto');
const db = require('../../database/db');

const sesiones = new Map();
const DURACION_SESION_MS = 12 * 60 * 60 * 1000;

function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
    return `scrypt$${salt}$${hash}`;
}

function listarUsuarios() {
    return db.prepare(`
        SELECT id, nombre, usuario, rol, activo, creado_en
        FROM usuarios
        ORDER BY activo DESC, CASE WHEN rol = 'administrador' THEN 0 ELSE 1 END, nombre COLLATE NOCASE
    `).all();
}

function generarUsuarioInterno(nombre, idExcluir = null) {
    const base = String(nombre)
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().trim().replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.|\.$/g, '') || 'usuario';
    let usuario = base;
    let numero = 2;
    while (db.prepare('SELECT id FROM usuarios WHERE usuario = ? AND id <> ?').get(usuario, idExcluir || 0)) {
        usuario = `${base}.${numero}`;
        numero += 1;
    }
    return usuario;
}

function validarDatosUsuario(datos, id = null) {
    const nombre = String(datos.nombre || '').trim();
    const rol = String(datos.rol || 'empleado');
    if (!nombre) throw new Error('El nombre es obligatorio');
    if (!['administrador', 'empleado'].includes(rol)) throw new Error('El rol no es válido');
    return { nombre, usuario: generarUsuarioInterno(nombre, id), rol };
}

function crearUsuario(datos) {
    const datosValidos = validarDatosUsuario(datos);
    const password = String(datos.password || '');
    if (password.length < 4) throw new Error('El PIN o contraseña debe tener al menos 4 caracteres');
    const resultado = db.prepare(`
        INSERT INTO usuarios (nombre, usuario, contrasena_hash, rol)
        VALUES (?, ?, ?, ?)
    `).run(datosValidos.nombre, datosValidos.usuario, hashPassword(password), datosValidos.rol);
    return db.prepare('SELECT id, nombre, usuario, rol, activo, creado_en FROM usuarios WHERE id = ?').get(resultado.lastInsertRowid);
}

function actualizarUsuario(id, datos) {
    const usuarioId = Number(id);
    const datosValidos = validarDatosUsuario(datos, usuarioId);
    const actual = db.prepare('SELECT id, rol FROM usuarios WHERE id = ?').get(usuarioId);
    if (!actual) return null;
    if (actual.rol === 'administrador' && datosValidos.rol !== 'administrador') {
        const administradores = db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = 1").get().total;
        if (administradores <= 1) throw new Error('No se puede quitar el último administrador activo');
    }
    db.prepare('UPDATE usuarios SET nombre = ?, rol = ? WHERE id = ?').run(datosValidos.nombre, datosValidos.rol, usuarioId);
    if (datos.password) {
        if (String(datos.password).length < 4) throw new Error('El PIN o contraseña debe tener al menos 4 caracteres');
        db.prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(hashPassword(datos.password), usuarioId);
    }
    return db.prepare('SELECT id, nombre, usuario, rol, activo, creado_en FROM usuarios WHERE id = ?').get(usuarioId);
}

function cambiarEstadoUsuario(id, activo) {
    const usuarioId = Number(id);
    const actual = db.prepare('SELECT id, rol, activo FROM usuarios WHERE id = ?').get(usuarioId);
    if (!actual) return null;
    if (!activo && actual.rol === 'administrador' && actual.activo) {
        const administradores = db.prepare("SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador' AND activo = 1").get().total;
        if (administradores <= 1) throw new Error('No se puede desactivar el último administrador activo');
    }
    db.prepare('UPDATE usuarios SET activo = ? WHERE id = ?').run(activo ? 1 : 0, usuarioId);
    return db.prepare('SELECT id, nombre, usuario, rol, activo, creado_en FROM usuarios WHERE id = ?').get(usuarioId);
}

function verificarPassword(password, almacenada) {
    if (!almacenada) return false;
    if (almacenada === 'local') return String(password) === 'local';
    const partes = String(almacenada).split('$');
    if (partes.length !== 3 || partes[0] !== 'scrypt') return false;
    const hash = crypto.scryptSync(String(password), partes[1], 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(partes[2], 'hex'));
}

function datosPublicos(usuario) {
    return { id: usuario.id, nombre: usuario.nombre, usuario: usuario.usuario, rol: usuario.rol };
}

function obtenerUsuariosAcceso() {
    return db.prepare(`
        SELECT id, nombre, rol
        FROM usuarios
        WHERE activo = 1
        ORDER BY CASE WHEN rol = 'empleado' THEN 0 ELSE 1 END, nombre COLLATE NOCASE
    `).all();
}

function crearSesion(usuario) {
    const token = crypto.randomBytes(32).toString('hex');
    sesiones.set(token, { usuario: datosPublicos(usuario), expira: Date.now() + DURACION_SESION_MS });
    return { token, usuario: datosPublicos(usuario) };
}

function iniciarSesionPorId(id, password) {
    const registro = db.prepare(`
        SELECT id, nombre, usuario, contrasena_hash, rol
        FROM usuarios
        WHERE id = ? AND activo = 1
    `).get(Number(id));
    if (!registro || !verificarPassword(password, registro.contrasena_hash)) return null;
    if (registro.contrasena_hash === 'local') {
        db.prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(hashPassword(password), registro.id);
    }
    return crearSesion(registro);
}

function iniciarSesion(usuario, password) {
    const registro = db.prepare(`
        SELECT id, nombre, usuario, contrasena_hash, rol
        FROM usuarios WHERE usuario = ? AND activo = 1
    `).get(String(usuario || '').trim());
    if (!registro || registro.rol !== 'administrador' || !verificarPassword(password, registro.contrasena_hash)) return null;

    if (registro.contrasena_hash === 'local') {
        db.prepare('UPDATE usuarios SET contrasena_hash = ? WHERE id = ?').run(hashPassword(password), registro.id);
    }

    return crearSesion(registro);
}

function obtenerSesion(token) {
    const sesion = sesiones.get(token);
    if (!sesion) return null;
    if (sesion.expira <= Date.now()) {
        sesiones.delete(token);
        return null;
    }
    return sesion.usuario;
}

function cerrarSesion(token) {
    sesiones.delete(token);
}

module.exports = { hashPassword, listarUsuarios, crearUsuario, actualizarUsuario, cambiarEstadoUsuario, obtenerUsuariosAcceso, iniciarSesion, iniciarSesionPorId, obtenerSesion, cerrarSesion };