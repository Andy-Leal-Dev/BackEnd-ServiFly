const db = require('../db/login');

const getUserById = (req, res) => {
    const userId = req.user.id; // extraido del JWT por middleware

    const query = `SELECT * FROM usuarios WHERE id = ?`;
    db.get(query, [userId], (err, user) => {
        if (err) {
            console.error('Error al obtener los datos del usuario:', err);
            return res.status(500).json({ error: 'Error al obtener los datos del usuario' });
        }
        if (!user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.status(200).json(user);
    });
};

module.exports = {
    getUserById
}