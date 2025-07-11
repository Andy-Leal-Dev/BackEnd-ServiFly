const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const authenticationToken = require('../middlewares/authMiddleware');
const upload = require('../middlewares/uploadMiddleware');


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

// obtener all professionals
router.get('/ProList',professionalController.getList )

module.exports = router;