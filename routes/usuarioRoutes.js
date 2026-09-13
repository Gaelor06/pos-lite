const express = require('express');
const router = express.Router();
const usuarioController = require('../src/controllers/usuarioController');
const { requerirAdministrador } = require('../src/middleware/roleMiddleware');

router.use(requerirAdministrador);
router.get('/', usuarioController.listar);
router.post('/', usuarioController.crear);
router.put('/:id', usuarioController.actualizar);
router.patch('/:id/activo', usuarioController.cambiarEstado);

module.exports = router;