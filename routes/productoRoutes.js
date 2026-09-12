const express = require('express');
const router = express.Router();
const productoController = require('../src/controller/productoController');

router.get('/', productoController.listar);
router.get('/:id', productoController.obtenerUno);
router.post('/', productoController.crear);
router.put('/:id', productoController.actualizarGeneral);
router.patch('/:id/precio', productoController.actualizarPrecio);
router.patch('/:id/activo', productoController.cambiarEstadoActivo);
router.patch('/:id/unidad-venta', productoController.cambiarUnidadVenta);

module.exports = router;