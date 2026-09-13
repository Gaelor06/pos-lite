const clienteModel = require('../models/clienteModel');

function listar(req, res) {
    res.json(clienteModel.obtenerTodos());
}

function obtenerUno(req, res) {
    const clienteId = Number(req.params.id);
    const cliente = clienteModel.obtenerPorId(clienteId);

    if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(cliente);
}

function actualizar(req, res) {
    try {
        const clienteActualizado = clienteModel.actualizarCliente(req.params.id, req.body);
        if (!clienteActualizado) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(clienteActualizado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

function cambiarEstadoActivo(req, res) {
    try {
        const clienteActualizado = clienteModel.cambiarEstadoActivo(req.params.id, req.body.activo);
        if (!clienteActualizado) {
            return res.status(404).json({ error: 'Cliente no encontrado' });
        }
        res.json(clienteActualizado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

function listarPreciosEspeciales(req, res) {
    const clienteId = Number(req.params.id);
    if (!Number.isInteger(clienteId) || clienteId <= 0) {
        return res.status(400).json({ error: 'El cliente no es válido' });
    }

    const cliente = clienteModel.obtenerPorId(clienteId);
    if (!cliente) {
        return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json(clienteModel.obtenerPreciosEspeciales(clienteId));
}

function guardarPrecioEspecial(req, res) {
    try {
        const datoGuardado = clienteModel.guardarPrecioEspecial(req.body);
        res.status(201).json(datoGuardado);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

function crear(req, res) {
    try {
        res.status(201).json(clienteModel.crear(req.body));
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
}

module.exports = {
    listar,
    obtenerUno,
    actualizar,
    cambiarEstadoActivo,
    listarPreciosEspeciales,
    guardarPrecioEspecial,
    crear
};
