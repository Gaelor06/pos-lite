const express = require('express');
const cors = require('cors');
const db = require('./database/db');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const productoRoutes = require('./routes/productoRoutes');
app.use('/api/productos', productoRoutes);

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡Servidor de la pescadería funcionando correctamente!' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

//ejemplo para ver si conecta
console.log('Conexión a la base de datos establecida:');
const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log(tablas);

