const categoriaModel = require('../models/categoriaModel');

function listar(req, res) {
    const categorias = categoriaModel.obtenerTodos();
    res.json(categorias);
}

function crear(req, res) {
    try {
            
    const nuevaCategoria = categoriaModel.crearCategoria(req.body);
    res.status(201).json(nuevaCategoria);

    }catch (error) {
        
        res.status(400).json({ error: error.message });
    }
}

module.exports = { listar, crear };