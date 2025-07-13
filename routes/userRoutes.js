const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middlewares/authMiddleware');
const uploadProfileMiddleware = require('../middlewares/uploadProfileMiddleware');
const checkBlockedUser = require('../middlewares/blockedMiddleware');

// Perfil de usuario
router.get('/perfil', authMiddleware, checkBlockedUser, userController.getProfile);
router.get('/perfil/profesional', authMiddleware, checkBlockedUser, userController.getMyProfileProfesional);
router.put('/updateprofile', authMiddleware, checkBlockedUser, uploadProfileMiddleware, userController.updateProfile);
router.post('/verify-email-code', authMiddleware, checkBlockedUser, userController.verifyEmailCode);


router.post('/ubicacion', authMiddleware, checkBlockedUser, userController.updateUserLocation);

router.get('/direcciones', authMiddleware, checkBlockedUser, userController.getSavedAddresses);
router.post('/direcciones', authMiddleware, checkBlockedUser, userController.addSavedAddress);
router.put('/direcciones/:id', authMiddleware, checkBlockedUser, userController.updateSavedAddress);
router.delete('/direcciones/:id', authMiddleware, checkBlockedUser, userController.deleteSavedAddress);
router.put('/direcciones/:id/set-principal', authMiddleware, checkBlockedUser, userController.setAsPrimaryAddress);


// Favoritos
router.get('/favoritos', authMiddleware, checkBlockedUser, userController.getFavorites);
router.get('/favoritos/:professionalId/check', authMiddleware, checkBlockedUser, userController.checkFavorite);
router.post('/favoritos/:professionalId', authMiddleware, checkBlockedUser, userController.addFavorite);
router.delete('/favoritos/:professionalId', authMiddleware, checkBlockedUser, userController.removeFavorite);


module.exports = router;