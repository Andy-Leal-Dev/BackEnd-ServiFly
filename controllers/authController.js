const bcrypt = require('bcrypt');
const db = require('../db/login');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const saltRounds = 10; // Aplica el hash al password
const nodemailer = require('nodemailer');

// Configura tu transporter de nodemailer
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
}); 


exports.register = async (req, res) => {
     const { nombre, telefono, email, password, fecha_nacimiento } = req.body;
    if (!nombre || !telefono || !email || !password || !fecha_nacimiento) {
        return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    try {
        // Verifica si el usuario ya existe
        db.get(`SELECT * FROM usuarios WHERE email = ?`, [email], async (err, user) => {
            if (user) {
                return res.status(400).json({ error: 'Email ya registrado' });
            }
            // Genera código de 6 dígitos
            const code = Math.floor(100000 + Math.random() * 900000);
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Inserta usuario con codeverify
            const query = `INSERT INTO usuarios (nombre, telefono, email, password, fecha_nacimiento, codeverify, is_active) VALUES (?, ?, ?, ?, ?, ?, 0)`;
            db.run(query, [nombre, telefono, email, hashedPassword, fecha_nacimiento, code], function (err) {
                if (err) {
                    return res.status(400).json({ error: 'Error en la base de datos' });
                }
                // Envía el código por correo
                transporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Código de verificación',
                    text: `Tu código de verificación es: ${code}`,
                }, (error, info) => {
                    if (error) {
                        return res.status(500).json({ error: 'No se pudo enviar el código' });
                    }
                    res.status(201).json({ message: 'Usuario registrado. Código enviado al correo.' });
                });
            });
        });
    } catch (error) {
        console.error('Error al registrar usuario:', error);
        res.status(500).json({ error: 'Error interno en el servidor' });
    }
};
exports.verifyCode = (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: 'Datos incompletos' });

    db.get(`SELECT codeverify FROM usuarios WHERE email = ?`, [email], (err, row) => {
        if (err || !row) {
            return res.status(400).json({ error: 'Usuario no encontrado' });
        }
        if (row.codeverify && row.codeverify.toString() === code.toString()) {
            // Actualiza is_active a TRUE y limpia el codeverify
            db.run(`UPDATE usuarios SET is_active = 1, codeverify = NULL WHERE email = ?`, [email], (err2) => {
                if (err2) {
                    return res.status(500).json({ error: 'No se pudo activar el usuario' });
                }
                return res.status(200).json({ message: 'Código verificado y usuario activado' });
            });
        } else {
            return res.status(400).json({ error: 'Código incorrecto' });
        }
    });
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