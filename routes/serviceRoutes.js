const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const authenticationToken = require('../middlewares/authMiddleware');

// Crear un nuevo servicio
router.post('/create', authenticationToken, serviceController.createService);

// Obtener servicios del usuario
router.get('/:role', authenticationToken, serviceController.getUserServices);

// Obtener detalles de un servicio específico
router.get('/by/:id', authenticationToken, serviceController.getServiceById);

// Actualizar estado de un servicio
router.put('/:id/status', authenticationToken, serviceController.updateServiceStatus);



// Calificar un servicio completado
router.post('/:id/rate', authenticationToken, serviceController.rateService);

module.exports = router;