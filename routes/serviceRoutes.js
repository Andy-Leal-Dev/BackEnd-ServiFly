const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authenticationToken = require('../middlewares/authMiddleware');
const checkBlockedUser = require('../middlewares/blockedMiddleware');

// Crear un nuevo servicio
router.post('/create', authenticationToken, checkBlockedUser, serviceController.createService);

// Obtener servicios del usuario
router.get('/:role', authenticationToken, checkBlockedUser, serviceController.getUserServices);

// Obtener detalles de un servicio específico
router.get('/by/:id', authenticationToken, checkBlockedUser, serviceController.getServiceById);

// Actualizar estado de un servicio
router.put('/:id/status', authenticationToken, checkBlockedUser, serviceController.updateServiceStatus);



// Calificar un servicio completado
router.post('/:id/rate', authenticationToken,checkBlockedUser,  serviceController.rateService);

module.exports = router;