const express = require('express');
const router = express.Router();
const gastoController = require('../src/controllers/gastoController');

router.get('/', gastoController.listar);
router.get('/resumen', gastoController.resumen);
router.post('/', gastoController.crear);

module.exports = router;