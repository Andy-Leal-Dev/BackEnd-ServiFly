const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/registro', authController.register);
router.post('/verifyCode', authController.verifyCode);
router.post('/login', authController.login);

module.exports = router;