const express = require('express');
const router = express.Router();
const clienteController = require('../src/controllers/clienteController');

router.get('/', clienteController.listar);
router.get('/:id', clienteController.obtenerUno);
router.get('/:id/precios', clienteController.listarPreciosEspeciales);
router.post('/precios', clienteController.guardarPrecioEspecial);
router.post('/', clienteController.crear);
router.put('/:id', clienteController.actualizar);
router.patch('/:id/activo', clienteController.cambiarEstadoActivo);

module.exports = router;
