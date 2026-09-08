const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Ruta de prueba
app.get('/api/ping', (req, res) => {
  res.json({ mensaje: '¡Servidor de la pescadería funcionando correctamente!' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});