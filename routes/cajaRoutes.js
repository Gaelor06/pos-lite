const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');

router.get('/estado', cajaController.estado);
router.get('/historial', cajaController.historial);
router.post('/abrir', cajaController.abrir);
router.post('/cerrar', cajaController.cerrar);

module.exports = router;