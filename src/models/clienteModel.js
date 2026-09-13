const db = require('../../database/db');

function obtenerTodos() {
    return db.prepare(`
        SELECT id, nombre, telefono
        FROM clientes
        WHERE activo = 1
        ORDER BY nombre COLLATE NOCASE
    `).all();
}

function crear(cliente) {
    const nombre = String(cliente.nombre || '').trim();
    const telefono = cliente.telefono ? String(cliente.telefono).trim() : null;

    if (!nombre) throw new Error('El nombre del cliente es obligatorio');

    const resultado = db.prepare(`
        INSERT INTO clientes (nombre, telefono)
        VALUES (?, ?)
    `).run(nombre, telefono);

    return db.prepare('SELECT id, nombre, telefono FROM clientes WHERE id = ?')
        .get(resultado.lastInsertRowid);
}

module.exports = { obtenerTodos, crear };
