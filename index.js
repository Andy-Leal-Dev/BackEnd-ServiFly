require('dotenv').config();

const express = require('express');
const app = express();

const authRoutes = require('./routes/authRoutes');

app.use(express.json());

app.use((req, res, next) => {
    console.log('Body recibido:', req.body);
    next();
});

// Usa las rutas
app.use('/', authRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
})