const express = require('express');
const router = express.Router();
const authenticationToken = require('../middlewares/authMiddleware');
const { GetClients, GetProfesionales, isUserBlocked, toggleUserBlock, services} = require('../controllers/adminController');


router.get('/getClients', authenticationToken, GetClients);
router.get('/getPro', authenticationToken, GetProfesionales);
router.get('/checkBlocked', authenticationToken, isUserBlocked);
router.put('/blockUser',   authenticationToken,  toggleUserBlock); // <- esta es la importante
router.get('/services', authenticationToken, services);

module.exports = router;
