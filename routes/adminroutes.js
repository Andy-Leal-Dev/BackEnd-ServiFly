const express = require('express');
const router = express.Router();
const {GetClients,GetProfesionales,isUserBlocked} = require('../controllers/adminController');

router.get('/admin/getClients',GetClients);
router.get('/admin/getPro',GetProfesionales);
router.get('/admin/CheckBlocked',isUserBlocked)



module.exports = router;