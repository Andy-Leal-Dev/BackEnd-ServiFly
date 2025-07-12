const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const authenticationToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');

router.get('/professions', professionalController.getProfessions);
router.get('/professions-specialties', professionalController.getProfessionsAndSpecialties);

// Paso 1: Selección de oficios y especialidades
router.post('/signup/step1', authenticationToken, professionalController.startProfessionalSignup);

// Paso 2: Completar información profesional
router.post('/signup/step2', authenticationToken, professionalController.completeProfessionalInfo);

// Subir documentos KYC
router.post(
    '/kyc/upload',
    authenticationToken,
    upload.fields([
        { name: 'idImage', maxCount: 1 },
        { name: 'selfieImage', maxCount: 1 }
    ]),
    professionalController.uploadKYCDocuments
);

// Obtener estado de verificación KYC
router.get('/kyc/status', authenticationToken, professionalController.getKYCStatus);

router.post('/update/location', authenticationToken, professionalController.updateProfessionalLocation);

router.get('/list', professionalController.getProfessionalList); // Todos los profesionales
router.get('/list/by-profession/:profession', professionalController.getProfessionalsByProfession);
router.get('/list/by-payment/:paymentMethod', professionalController.getProfessionalsByPaymentMethod);
router.get('/list/nearby', authenticationToken, professionalController.getNearbyProfessionals);

// Ruta existente que parece similar pero puede necesitar ajustes
router.get('/ProList', professionalController.getList);
router.get('/get/:id', professionalController.getProfessionalById);

module.exports = router;