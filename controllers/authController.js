const bcrypt = require('bcrypt');
const db = require('../db/login');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const saltRounds = 10; // Aplica el hash al password

exports.register = async (req, res) => {
    const { nombre, telefono, email, password, fecha_nacimiento} = req.body;
    if (!nombre || !telefono || !email || !password, !fecha_nacimiento) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    } 

    try {
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const query = `INSERT INTO usuarios (nombre, telefono, email, password, fecha_nacimiento) VALUES (?, ?, ?, ?, ?)`;
        db.run(query, [nombre, telefono, email, hashedPassword, fecha_nacimiento], function (err) {
            if (err) {
                if (err.message.includes('email')){
                    return res.status(400).json({ error: 'Email ya registrado' });
                }
                if (err.message.includes('telefono')){
                    return res.status(400).json({ error: 'Telefono ya registrado' });
                }
                return res.status(400).json({ error: 'Error en la base de datos' });
            }

            const token = jwt.sign({ id: this.lastID, email }, JWT_SECRET, { expiresIn: '24h' });
            res.status(201).json({ id: this.lastID, nombre, email, token });
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
};

exports.login = async (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
        if (err) {
            console.error('Error al buscar usuario:', err);
            return res.status(500).json({ error: 'Error al buscar usuario' });
        }
        if (!user) {
            return res.status(401).json({ error: 'Email no encontrado' });
        }

        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '24h' });

        res.status(200).json({
            message: 'Inicio de sesión exitoso',
            usuario: {
                id: user.id,
                nombre: user.nombre,
                telefono: user.telefono,
                email: user.email,
            },
            token
        });
    });
};