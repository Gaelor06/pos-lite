const express = require('express');
const router = express.Router();
const inventarioController = require('../src/controllers/inventarioController');

router.get('/', inventarioController.listar);
router.get('/movimientos', inventarioController.listarMovimientos);
router.post('/entradas', inventarioController.registrarEntrada);
router.post('/conversiones', inventarioController.registrarConversion);

module.exports = router;