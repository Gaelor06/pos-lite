const express = require('express');
const router = express.Router();
const clienteController = require('../src/controllers/clienteController');

router.get('/', clienteController.listar);
router.post('/', clienteController.crear);

module.exports = router;
