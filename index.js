const express = require('express');
const bcrypt = require('bcrypt');
const db = require('./db/login')

const app = express();
app.use(express.json());

const saltRounds = 10; // Aplica el hash al password

// Registro

app.post('/registro', async (req, res) => {
    const { nombre, telefono, email, password } = req.body;
    if (!nombre || !telefono || !email || !password) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try { 
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const query = `INSERT INTO usuarios (nombre, telefono, email, password) VALUES (?, ?, ?, ?)`;
    db.run(query, [nombre, telefono, email, hashedPassword], function (err) {
        if (err) {
            return res.status(400).json({ error: 'Email ya registrado' });
        }
        // Si no hay error, respondemos con éxito
        res.status(201).json({ id: this.lastID, nombre, email });
    });
    } catch (error) {
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
}); 

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Error al buscar usuario' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Email no encontrado' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        res.status(200).json({
            message: 'Inicio de sesion exitoso',
            usuario: {
                id: user.id,
                nombre: user.nombre,
                telefono: user.telefono,
                email: user.email,
                rol: user.rol
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
})
