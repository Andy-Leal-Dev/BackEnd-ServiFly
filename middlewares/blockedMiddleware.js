const { isUserBlocked } = require('../controllers/adminController'); //Verifico con la función del controlador

const checkBlockedUser = async (req, res, next) => {
  try {
    const isBlocked = await isUserBlocked(req.user.id);
    if (isBlocked) {
      return res.status(403).json({ error: 'Usuario bloqueado' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Error al verificar estado del usuario' });
  }
};

module.exports = checkBlockedUser;
