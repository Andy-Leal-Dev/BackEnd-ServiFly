require('dotenv').config();

const express = require('express');
const app = express();

const authRoutes = require('./routes/authRoutes');
const userRouter = require('./routes/userRoutes');
const professionalRouter = require('./routes/professionalRoutes')
const serviceRouter = require('./routes/serviceRoutes');
const adminRouter = require('./routes/adminroutes')
const morgan = require('morgan');
const path = require('path');
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
})