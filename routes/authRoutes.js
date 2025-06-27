const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registro', authController.register);
router.post('/verifyCode', authController.verifyCode);
router.post('/login', authController.login);
router.post('/emailsend', authController.forgotPassword);
router.post('/resetCode', authController.verifyResetCode);
router.post('/resetPassword', authController.resetPassword);


module.exports = router;