// database/db.js
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DB_DIR, 'poslite.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

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

    return db;
}

module.exports = conectar();