const db = require('../../database/db');

function obtenerTodos() {
    return db.prepare(`
        SELECT g.id, g.fecha_hora, g.categoria, g.monto, g.metodo_pago,
               g.origen_fondos, g.descripcion, u.nombre AS usuario_nombre
        FROM gastos g
        JOIN usuarios u ON u.id = g.usuario_id
        ORDER BY g.id DESC
    `).all();
}

function obtenerResumen() {
    return db.prepare(`
        SELECT
            COALESCE(SUM(monto), 0) AS total,
            COALESCE(SUM(CASE WHEN origen_fondos = 'caja' AND metodo_pago = 'efectivo' THEN monto ELSE 0 END), 0) AS total_caja,
            COALESCE(SUM(CASE WHEN origen_fondos = 'externo' THEN monto ELSE 0 END), 0) AS total_externo,
            COUNT(*) AS cantidad
        FROM gastos
    `).get();
}

function validarUsuario(usuarioId) {
    const idSolicitado = Number(usuarioId);
    const id = idSolicitado > 0
        ? idSolicitado
        : db.prepare('SELECT id FROM usuarios WHERE activo = 1 ORDER BY id LIMIT 1').get()?.id;
    const usuario = db.prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1').get(id);
    if (!usuario) throw new Error('El usuario no es válido');
    return id;
}

function crear(gasto) {
    const categoria = String(gasto.categoria || '').trim();
    const monto = Number(gasto.monto);
    const metodoPago = String(gasto.metodo_pago || '').trim();
    const origenFondos = String(gasto.origen_fondos || 'caja').trim();
    const descripcion = String(gasto.descripcion || '').trim() || null;

    if (!categoria) throw new Error('La categoría del gasto es obligatoria');
    if (!Number.isInteger(monto) || monto <= 0) throw new Error('El monto debe ser un número entero mayor que cero');
    if (!['efectivo', 'sinpe', 'tarjeta'].includes(metodoPago)) throw new Error('El método de pago no es válido');
    if (!['caja', 'externo'].includes(origenFondos)) throw new Error('El origen de fondos no es válido');

    const resultado = db.prepare(`
        INSERT INTO gastos (categoria, monto, metodo_pago, origen_fondos, descripcion, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(categoria, monto, metodoPago, origenFondos, descripcion, validarUsuario(gasto.usuario_id));

    return db.prepare(`
        SELECT id, fecha_hora, categoria, monto, metodo_pago, origen_fondos, descripcion
        FROM gastos WHERE id = ?
    `).get(resultado.lastInsertRowid);
}

module.exports = { obtenerTodos, obtenerResumen, crear };