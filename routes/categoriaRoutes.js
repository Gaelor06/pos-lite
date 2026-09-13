const express = require('express');
const router = express.Router();
const categoriaController = require('../src/controllers/categoriaController');

router.get('/', categoriaController.listar);
router.post('/', categoriaController.crear);

module.exports = router;