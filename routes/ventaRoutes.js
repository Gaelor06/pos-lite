const express = require('express');
const router = express.Router();
const ventaController = require('../src/controllers/ventaController');

router.get('/', ventaController.listar);
router.get('/:id', ventaController.obtenerUno);
router.post('/', ventaController.crear);
router.patch('/:id/cancelar', ventaController.cancelar);

module.exports = router;