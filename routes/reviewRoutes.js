const express = require('express');
const router = express.Router();
const reviewController = require('../controllers/reviewController');
const authenticationToken = require('../middlewares/authMiddleware');
const checkBlockedUser = require('../middlewares/blockedMiddleware');

// Crear una nueva reseña
router.post('/', authenticationToken, checkBlockedUser, reviewController.createReview);

// Responder a una reseña (solo el profesional)
router.post('/:id/respond', authenticationToken, reviewController.respondToReview);

// Obtener reseñas de un profesional
router.get('/professional/:id',authenticationToken, reviewController.getProfessionalReviews);

// Obtener reseñas dejadas por el usuario actual
router.get('/user', authenticationToken, checkBlockedUser, reviewController.getUserReviews);


router.get('/:id/resenas/resumen', authenticationToken, reviewController.getProfessionalReviewsSummary);
module.exports = router;