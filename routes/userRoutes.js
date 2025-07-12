const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadProfileMiddleware = require('../middlewares/uploadProfileMiddleware');

// Perfil de usuario
router.get('/perfil', authMiddleware, userController.getProfile);
router.get('/perfil/profesional', authMiddleware, userController.getMyProfileProfesional);
router.put('/updateprofile', authMiddleware, uploadProfileMiddleware, userController.updateProfile);
router.post('/verify-email-code', authMiddleware, userController.verifyEmailCode);


router.post('/ubicacion', authMiddleware, userController.updateUserLocation);

router.get('/direcciones', authMiddleware, userController.getSavedAddresses);
router.post('/direcciones', authMiddleware, userController.addSavedAddress);
router.put('/direcciones/:id', authMiddleware, userController.updateSavedAddress);
router.delete('/direcciones/:id', authMiddleware, userController.deleteSavedAddress);
router.put('/direcciones/:id/set-principal', authMiddleware, userController.setAsPrimaryAddress);

// Favoritos
router.get('/favoritos', authMiddleware, userController.getFavorites);
router.post('/favoritos/:profesionalId', authMiddleware, userController.addFavorite);
router.delete('/favoritos/:profesionalId', authMiddleware, userController.removeFavorite);


module.exports = router;