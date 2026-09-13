// database/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'poslite.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');
const sembrarProductos = require('./seedProductos');

function conectar() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });   // crea data/ si no existe
    }

    const esNueva = !fs.existsSync(DB_PATH);

    const db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');

    if (esNueva) {
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        db.exec(schema);
        console.log('Base de datos creada desde schema.sql');
    }

    const usuarios = db.prepare('SELECT COUNT(*) AS total FROM usuarios').get();
    if (usuarios.total === 0) {
        db.prepare(`
            INSERT INTO usuarios (nombre, usuario, contrasena_hash, rol)
            VALUES (?, ?, ?, ?)
        `).run('Caja local', 'local', 'local', 'administrador');
    }

    const existePreciosEspeciales = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get('clientes_precios_especiales');

    if (!existePreciosEspeciales) {
        db.exec(`
            CREATE TABLE clientes_precios_especiales (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cliente_id INTEGER NOT NULL REFERENCES clientes(id),
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                precio_especial INTEGER NOT NULL,
                creado_en TEXT NOT NULL DEFAULT (datetime('now')),
                UNIQUE (cliente_id, producto_id)
            )
        `);
    }

    const columnasVentas = db.prepare('PRAGMA table_info(ventas)').all();
    if (!columnasVentas.some(columna => columna.name === 'comprador_nombre')) {
        db.exec('ALTER TABLE ventas ADD COLUMN comprador_nombre TEXT');
    }

    const columnasCaja = db.prepare('PRAGMA table_info(caja_cierres)').all();
    if (columnasCaja.length > 0 && !columnasCaja.some(columna => columna.name === 'cerrado_por_usuario_id')) {
        db.exec('ALTER TABLE caja_cierres ADD COLUMN cerrado_por_usuario_id INTEGER REFERENCES usuarios(id)');
    }

    const existeHistorialPrecios = db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?"
    ).get('productos_historial_precios');
    if (!existeHistorialPrecios) {
        db.exec(`
            CREATE TABLE productos_historial_precios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                producto_id INTEGER NOT NULL REFERENCES productos(id),
                precio_anterior INTEGER NOT NULL,
                precio_nuevo INTEGER NOT NULL,
                motivo TEXT NOT NULL,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
                creado_en TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE INDEX idx_historial_precios_producto ON productos_historial_precios(producto_id);
        `);
    }

    sembrarProductos(db);

    return db;
}

module.exports = conectar();