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


// Direcciones
router.get('/direcciones', authMiddleware, userController.getAddresses);
router.post('/direcciones', authMiddleware, userController.addAddress);
router.put('/direcciones/:id', authMiddleware, userController.updateAddress);
router.delete('/direcciones/:id', authMiddleware, userController.deleteAddress);

// Favoritos
router.get('/favoritos', authMiddleware, userController.getFavorites);
router.post('/favoritos/:profesionalId', authMiddleware, userController.addFavorite);
router.delete('/favoritos/:profesionalId', authMiddleware, userController.removeFavorite);

module.exports = router;