const express = require('express');
const router = express.Router();
const { getUserById } = require('../controllers/userController');
const authenticationToken = require('../middlewares/authMiddleware');

router.get('/perfil', authenticationToken, getUserById);

module.exports = router;