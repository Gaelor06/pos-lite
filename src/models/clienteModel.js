const db = require('../../database/db');

function obtenerTodos() {
    return db.prepare(`
        SELECT id, nombre, telefono
        FROM clientes
        WHERE activo = 1
        ORDER BY nombre COLLATE NOCASE
    `).all();
}

function obtenerPorId(id) {
    return db.prepare('SELECT id, nombre, telefono, activo FROM clientes WHERE id = ?').get(id);
}

function actualizarCliente(id, cliente) {
    const clienteId = Number(id);
    const nombre = String(cliente.nombre || '').trim();
    const telefono = cliente.telefono === undefined || cliente.telefono === null ? null : String(cliente.telefono).trim();

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
        throw new Error('El cliente no es válido');
    }
    if (!nombre) {
        throw new Error('El nombre del cliente es obligatorio');
    }

    const resultado = db.prepare(`
        UPDATE clientes
        SET nombre = ?, telefono = ?
        WHERE id = ?
    `).run(nombre, telefono, clienteId);

    return resultado.changes > 0 ? obtenerPorId(clienteId) : null;
}

function cambiarEstadoActivo(id, activo) {
    const clienteId = Number(id);
    const estado = !!activo ? 1 : 0;

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
        throw new Error('El cliente no es válido');
    }

    const resultado = db.prepare(`
        UPDATE clientes
        SET activo = ?
        WHERE id = ?
    `).run(estado, clienteId);

    return resultado.changes > 0 ? obtenerPorId(clienteId) : null;
}

function obtenerPreciosEspeciales(clienteId) {
    return db.prepare(`
        SELECT cpe.id, cpe.cliente_id, cpe.producto_id, c.nombre AS cliente_nombre, p.nombre AS producto_nombre,
               p.unidad_venta, cpe.precio_especial
        FROM clientes_precios_especiales cpe
        JOIN clientes c ON c.id = cpe.cliente_id
        JOIN productos p ON p.id = cpe.producto_id
        WHERE cpe.cliente_id = ? AND p.activo = 1 AND c.activo = 1
        ORDER BY p.nombre COLLATE NOCASE
    `).all(clienteId);
}

function obtenerPrecioEspecial(clienteId, productoId) {
    if (!clienteId || !productoId) return null;
    const fila = db.prepare(`
                SELECT cpe.precio_especial
                FROM clientes_precios_especiales cpe
                JOIN clientes c ON c.id = cpe.cliente_id
                JOIN productos p ON p.id = cpe.producto_id
                WHERE cpe.cliente_id = ? AND cpe.producto_id = ?
                    AND c.activo = 1 AND p.activo = 1
    `).get(clienteId, productoId);
    return fila ? Number(fila.precio_especial) : null;
}

function guardarPrecioEspecial({ cliente_id, producto_id, precio_especial }) {
    const clienteId = Number(cliente_id);
    const productoId = Number(producto_id);
    const precioEspecial = Number(precio_especial);

    if (!Number.isInteger(clienteId) || clienteId <= 0) {
        throw new Error('El cliente es inválido');
    }
    if (!Number.isInteger(productoId) || productoId <= 0) {
        throw new Error('El producto es inválido');
    }
    if (!Number.isFinite(precioEspecial) || precioEspecial < 0) {
        throw new Error('El precio especial debe ser un número válido y mayor o igual a cero');
    }

    const clienteExiste = db.prepare('SELECT id FROM clientes WHERE id = ? AND activo = 1').get(clienteId);
    if (!clienteExiste) throw new Error('El cliente no existe o está inactivo');

    const productoExiste = db.prepare('SELECT id FROM productos WHERE id = ? AND activo = 1').get(productoId);
    if (!productoExiste) throw new Error('El producto no existe o está inactivo');

    const registro = db.prepare(`
        SELECT id FROM clientes_precios_especiales WHERE cliente_id = ? AND producto_id = ?
    `).get(clienteId, productoId);

    if (registro) {
        db.prepare(`
            UPDATE clientes_precios_especiales
            SET precio_especial = ?, creado_en = datetime('now')
            WHERE id = ?
        `).run(precioEspecial, registro.id);
    } else {
        db.prepare(`
            INSERT INTO clientes_precios_especiales (cliente_id, producto_id, precio_especial)
            VALUES (?, ?, ?)
        `).run(clienteId, productoId, precioEspecial);
    }

    return db.prepare(`
        SELECT cpe.id, cpe.cliente_id, cpe.producto_id, p.nombre AS producto_nombre, p.unidad_venta,
               cpe.precio_especial
        FROM clientes_precios_especiales cpe
        JOIN productos p ON p.id = cpe.producto_id
        WHERE cpe.cliente_id = ? AND cpe.producto_id = ?
    `).get(clienteId, productoId);
}

function crear(cliente) {
    const nombre = String(cliente.nombre || '').trim();
    const telefono = cliente.telefono ? String(cliente.telefono).trim() : null;

    if (!nombre) throw new Error('El nombre del cliente es obligatorio');

    const resultado = db.prepare(`
        INSERT INTO clientes (nombre, telefono)
        VALUES (?, ?)
    `).run(nombre, telefono);

    return obtenerPorId(resultado.lastInsertRowid);
}

module.exports = {
    obtenerTodos,
    obtenerPorId,
    actualizarCliente,
    cambiarEstadoActivo,
    obtenerPreciosEspeciales,
    obtenerPrecioEspecial,
    guardarPrecioEspecial,
    crear
};
