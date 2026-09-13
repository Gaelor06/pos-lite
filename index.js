const express = require('express');
const cors = require('cors');
const path = require('path'); // <-- 1. IMPORTANTE: Agrega este módulo nativo
const db = require('./database/db');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir los archivos estáticos (CSS, JS, subpáginas como productos.html y categorias.html)
app.use(express.static(path.join(__dirname, 'public'), { index: false }));


app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'ventas.html'));
});

// Rutas
const productoRoutes = require('./routes/productoRoutes');
const categoriaRoutes = require('./routes/categoriaRoutes');
const ventaRoutes = require('./routes/ventaRoutes');
const clienteRoutes = require('./routes/clienteRoutes');
app.use('/api/productos', productoRoutes);
app.use('/api/categorias', categoriaRoutes);
app.use('/api/ventas', ventaRoutes);
app.use('/api/clientes', clienteRoutes);

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡Servidor de la pescadería funcionando correctamente!' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});