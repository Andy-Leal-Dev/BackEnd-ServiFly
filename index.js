require('dotenv').config();

const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http, {
  cors: {
    origin: "*", // Ajusta esto según tus necesidades de producción
    methods: ["GET", "POST"]
  }
});

const authRoutes = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const professionalRouter = require('./routes/professionalRoutes')
const serviceRouter = require('./routes/serviceRoutes');
const adminRouter = require('./routes/adminroutes')
const morgan = require('morgan');
const path = require('path');
const db = require('./db/users');

// Configuración de Socket.io
io.on('connection', (socket) => {
  console.log('Nuevo cliente conectado:', socket.id);

  // Unirse a una sala específica de servicio
  socket.on('joinServiceRoom', (serviceId) => {
    socket.join(`service_${serviceId}`);
    console.log(`Usuario unido a la sala service_${serviceId}`);
  });

  // Manejar mensajes
  socket.on('sendMessage', async ({ serviceId, senderId, receiverId, message }) => {
    try {
      // Guardar mensaje en la base de datos
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO Mensajes (id_servicio, id_remitente, id_destinatario, mensaje) 
           VALUES (?, ?, ?, ?)`,
          [serviceId, senderId, receiverId, message],
          function(err) {
            if (err) reject(err);
            resolve(this.lastID);
          }
        );
      });

      // Obtener el mensaje recién creado
      const savedMessage = await new Promise((resolve, reject) => {
        db.get(
          `SELECT m.*, u.nombre as remitente_nombre, u.foto_perfil as remitente_foto
           FROM Mensajes m
           JOIN usuarios u ON m.id_remitente = u.id
           WHERE m.id = ?`,
          [result],
          (err, row) => {
            if (err) reject(err);
            resolve(row);
          }
        );
      });

      // Emitir el mensaje a todos en la sala del servicio
      io.to(`service_${serviceId}`).emit('newMessage', savedMessage);
      
    } catch (error) {
      console.error('Error al guardar/enviar mensaje:', error);
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/uploads/profiles', express.static(path.join(__dirname, 'profiles')));
app.use('/uploads/profile/temp', express.static(path.join(__dirname, 'profile/temp')));
app.use(express.json());
app.use(morgan('dev'))
app.use((req, res, next) => {
    console.log('Body recibido:', req.body);
    next();
});
app.use((req, res, next) => {
    console.log('Body recibido:', res.json.toString);
    next();
});

// Usa las rutas
app.use('/', authRoutes);
app.use('/user', userRouter);
app.use('/professional', professionalRouter)
app.use('/services', serviceRouter);
app.use('/admin', adminRouter);

// Nueva ruta para obtener historial de mensajes
app.get('/messages/:serviceId', async (req, res) => {
  try {
    const messages = await new Promise((resolve, reject) => {
      db.all(
        `SELECT m.*, u.nombre as remitente_nombre, u.foto_perfil as remitente_foto
         FROM Mensajes m
         JOIN usuarios u ON m.id_remitente = u.id
         WHERE m.id_servicio = ?
         ORDER BY m.fecha_envio ASC`,
        [req.params.serviceId],
        (err, rows) => {
          if (err) reject(err);
          resolve(rows);
        }
      );
    });

    res.status(200).json(messages);
  } catch (error) {
    console.error('Error al obtener mensajes:', error);
    res.status(500).json({ error: 'Error al obtener mensajes' });
  }
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});