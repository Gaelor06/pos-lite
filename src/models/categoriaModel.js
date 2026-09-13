const db = require('../../database/db');

function obtenerCategoriaPorId(id) {
    return db.prepare('SELECT * FROM categorias WHERE id = ?').get(id);
}


function obtenerTodos(){

    return db.prepare('SELECT * FROM categorias').all();

}

function crearCategoria(categoria) {

    const resultado = db.prepare(`

        INSERT INTO categorias
         (nombre )
        VALUES (?)

    `).run(

        categoria.nombre

    );

    return obtenerCategoriaPorId(resultado.lastInsertRowid);

}

module.exports = { obtenerTodos, crearCategoria, obtenerCategoriaPorId };