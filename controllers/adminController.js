// adminControllers.js (funciones completadas)
const db = require('../models/users');

exports.GetClients = async (req, res) => {
  try {
    const sql = `
      SELECT * 
      FROM usuarios 
      WHERE is_professional = 0
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Error al obtener clientes:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      res.status(200).json(rows);
    });
  } catch (error) {
    console.error('Error al obtener los usuarios no profesionales', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.GetProfesionales = async (req, res) => {
  try {
    const sql = `
      SELECT u.*, p.descripcion, p.tarifa_por_hora 
      FROM usuarios u
      INNER JOIN Profesionales p ON u.id = p.id_usuario
      WHERE u.is_professional = 1
    `;
    
    db.all(sql, [], (err, rows) => {
      if (err) {
        console.error('Error al obtener profesionales:', err);
        return res.status(500).json({ error: 'Error interno del servidor' });
      }
      res.status(200).json(rows);
    });
  } catch (error) {
    console.error('Error al obtener usuarios profesionales', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

exports.isUserBlocked = async (userId) => {
  return new Promise((resolve, reject) => {
    const sql = `SELECT is_blocked FROM usuarios WHERE id = ?`;
    db.get(sql, [userId], (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row ? row.is_blocked === 1 : false);
    });
  });
};

// Bloquear o desbloquear un usuario
exports.toggleUserBlock = (req, res) => {
  const { userId, block } = req.body;

  if (typeof userId === 'undefined' || typeof block === 'undefined') {
    return res.status(400).json({ error: 'Faltan datos requeridos (userId y block)' });
  }

  const query = `UPDATE usuarios SET is_blocked = ? WHERE id = ?`;

  db.run(query, [block ? 1 : 0, userId], function (err) {
    if (err) {
      console.error('Error al cambiar estado de bloqueo:', err);
      return res.status(500).json({ error: 'Error al actualizar estado del usuario' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    const status = block ? 'bloqueado' : 'desbloqueado';
    res.status(200).json({ message: `Usuario ${status} correctamente` });
  });
};

// Obtener todos los servicios aceptados y completados
exports.services = (req, res) => {
  const sql = `
    SELECT 
      s.*,
      u.nombre AS cliente_nombre
    FROM Servicios s
    JOIN usuarios u ON s.id_cliente = u.id
    WHERE s.estado IN ('pendiente', 'completado')
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener servicios:', err);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    res.status(200).json(rows);
  });
};

// Ejemplo de uso en un middleware:
// exports.checkBlockedUser = async (req, res, next) => {
//   try {
//     const isBlocked = await exports.isUserBlocked(req.user.id);
//     if (isBlocked) {
//       return res.status(403).json({ error: 'Usuario bloqueado' });
//     }
//     next();
//   } catch (error) {
//     res.status(500).json({ error: 'Error al verificar estado del usuario' });
//   }
// };