const express = require('express');
const router = express.Router();
const authController = require('../src/controllers/authController');
const { requerirAutenticacion } = require('../src/middleware/authMiddleware');

router.get('/usuarios', authController.usuariosAcceso);
router.post('/login', authController.iniciarSesion);
router.post('/login-seleccion', authController.iniciarSesionSeleccion);
router.get('/me', requerirAutenticacion, authController.sesionActual);
router.post('/logout', requerirAutenticacion, authController.cerrarSesion);

module.exports = router;