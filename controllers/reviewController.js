const db = require('../db/users');

// Helper para manejar errores de la base de datos
const handleDbError = (res, err, message = 'Error en la base de datos') => {
    console.error(err);
    return res.status(500).json({ error: message, details: err.message });
};

// Crear una nueva reseña
exports.createReview = async (req, res) => {
    const userId = req.user.id;
    const { id_profesional, calificacion, comentario, id_servicio } = req.body;

    // Validaciones básicas
    if (!id_profesional || !calificacion) {
        return res.status(400).json({ error: 'ID del profesional y calificación son requeridos' });
    }

    if (calificacion < 1 || calificacion > 5) {
        return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
    }

    try {
        // Verificar que el profesional existe
        const profesional = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Profesionales WHERE id = ?', [id_profesional], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado' });
        }

        // Verificar que el usuario no haya dejado ya una reseña para este profesional
        const existingReview = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Resenas WHERE id_usuario = ? AND id_profesional = ?', 
                  [userId, id_profesional], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (existingReview) {
            return res.status(400).json({ error: 'Ya has dejado una reseña para este profesional' });
        }

        // Si se proporciona id_servicio, verificar que el usuario participó en ese servicio
        if (id_servicio) {
            const servicio = await new Promise((resolve, reject) => {
                db.get(`
                    SELECT id 
                    FROM Servicios 
                    WHERE id = ? AND (id_cliente = ? OR id_profesional = ?)
                `, [id_servicio, userId, userId], (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                });
            });

            if (!servicio) {
                return res.status(403).json({ 
                    error: 'No tienes permiso para dejar una reseña para este servicio' 
                });
            }
        }

        // Iniciar transacción
        await new Promise((resolve, reject) => {
            db.run('BEGIN TRANSACTION', (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Insertar la reseña
        const result = await new Promise((resolve, reject) => {
            const query = `
                INSERT INTO Resenas (
                    id_profesional, id_usuario, id_servicio, 
                    calificacion, comentario
                ) VALUES (?, ?, ?, ?, ?)
            `;
            
            db.run(query, [
                id_profesional, userId, id_servicio || null, 
                calificacion, comentario || null
            ], function(err) {
                if (err) reject(err);
                resolve(this);
            });
        });

        // Actualizar el promedio del profesional
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE Profesionales
                SET 
                    promedio_calificacion = (
                        SELECT AVG(calificacion) 
                        FROM Resenas 
                        WHERE id_profesional = ?
                    ),
                    total_resenias = (
                        SELECT COUNT(*) 
                        FROM Resenas 
                        WHERE id_profesional = ?
                    )
                WHERE id = ?
            `, [id_profesional, id_profesional, id_profesional], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Commit de la transacción
        await new Promise((resolve, reject) => {
            db.run('COMMIT', (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Obtener la reseña recién creada con información del usuario
        const nuevaResena = await new Promise((resolve, reject) => {
            db.get(`
                SELECT r.*, u.nombre as usuario_nombre, u.foto_perfil as usuario_foto
                FROM Resenas r
                JOIN usuarios u ON r.id_usuario = u.id
                WHERE r.id = ?
            `, [result.lastID], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.status(201).json({
            message: 'Reseña creada exitosamente',
            resena: nuevaResena,
            profesional: {
                id: id_profesional,
                promedio_calificacion: await getPromedioProfesional(id_profesional),
                total_resenias: await getTotalResenias(id_profesional)
            }
        });

    } catch (err) {
        // Rollback en caso de error
        await new Promise((resolve) => {
            db.run('ROLLBACK', (rollbackErr) => {
                if (rollbackErr) console.error('Error en rollback:', rollbackErr);
                resolve();
            });
        });
        
        handleDbError(res, err, 'Error al crear la reseña');
    }
};

// Responder a una reseña (solo el profesional dueño)
exports.respondToReview = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { respuesta } = req.body;
    console.log('Respuesta recibida:', respuesta);
    console.log('id', id)
    if (!respuesta) {
        return res.status(400).json({ error: 'La respuesta es requerida' });
    }

    try {
        // Verificar que la reseña existe y que el usuario es el profesional asociado
        const resena = await new Promise((resolve, reject) => {
            db.get(`
                SELECT r.id, r.id_profesional, p.id_usuario
                FROM Resenas r
                JOIN Profesionales p ON r.id_profesional = p.id
                WHERE r.id = ?
            `, [id], (err, row) => {
                if (err) {
                    console.log(err)
                    reject(err);
                } else{
                    console.log(row)
                    resolve(row);
                }
                
            });
        });

        if (!resena) {
            return res.status(404).json({ error: 'Reseña no encontrada' });
        }

        if (resena.id_usuario !== userId) {
            return res.status(403).json({ 
                error: 'No tienes permiso para responder a esta reseña' 
            });
        }

        // Actualizar la reseña con la respuesta
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE Resenas
                SET respuesta = ?, fecha_respuesta = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [respuesta, id], (err, row) => {
               if (err) {
                    console.log(err)
                    reject(err);
                } else{
                    console.log(row)
                    resolve(row);
                }
            });
        });

        // Obtener la reseña actualizada
        const resenaActualizada = await new Promise((resolve, reject) => {
            db.get(`
                SELECT r.*, u.nombre as usuario_nombre, u.foto_perfil as usuario_foto
                FROM Resenas r
                JOIN usuarios u ON r.id_usuario = u.id
                WHERE r.id = ?
            `, [id], (err, row) => {
                if (err) {
                    console.log(err)
                    reject(err);
                } else{
                    console.log(row)
                    resolve(row);
                }
            });
        });

        res.status(200).json({
            message: 'Respuesta agregada exitosamente',
            resena: resenaActualizada
        });

    } catch (err) {
        handleDbError(res, err, 'Error al responder a la reseña');
    }
};

// Obtener reseñas de un profesional
exports.getProfessionalReviews = async (req, res) => {
    const { id } = req.params;
    const { limit = 10, offset = 0 } = req.query;

    try {
        // Verificar que el profesional existe
        const profesional = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Profesionales WHERE id_usuario = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado' });
        }

        // Obtener las reseñas
        const resenas = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    r.*, 
                    u.nombre as usuario_nombre, 
                    u.foto_perfil as usuario_foto,
                    s.id as servicio_id,
                    s.fecha_servicio as servicio_fecha
                FROM Resenas r
                JOIN usuarios u ON r.id_usuario = u.id
                LEFT JOIN Servicios s ON r.id_servicio = s.id
                WHERE r.id_profesional = ?
                ORDER BY r.fecha_creacion DESC
                LIMIT ? OFFSET ?
            `, [id, parseInt(limit), parseInt(offset)], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Obtener el conteo total de reseñas
        const total = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as total 
                FROM Resenas 
                WHERE id_profesional = ?
            `, [id], (err, row) => {
                if (err) reject(err);
                resolve(row.total);
            });
        });

        res.status(200).json({
            resenas,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            promedio: await getPromedioProfesional(id),
            profesional: {
                id,
                promedio_calificacion: await getPromedioProfesional(id),
                total_resenias: await getTotalResenias(id)
            }
        });

    } catch (err) {
        handleDbError(res, err, 'Error al obtener las reseñas');
    }
};

// Obtener reseñas dejadas por un usuario
exports.getUserReviews = async (req, res) => {
    const userId = req.user.id;
    const { limit = 10, offset = 0 } = req.query;

    try {
        const resenas = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    r.*, 
                    p.id as profesional_id,
                    u.nombre as profesional_nombre,
                    u.foto_perfil as profesional_foto,
                    s.id as servicio_id,
                    s.fecha_servicio as servicio_fecha
                FROM Resenas r
                JOIN Profesionales p ON r.id_profesional = p.id
                JOIN usuarios u ON p.id_usuario = u.id
                LEFT JOIN Servicios s ON r.id_servicio = s.id
                WHERE r.id_usuario = ?
                ORDER BY r.fecha_creacion DESC
                LIMIT ? OFFSET ?
            `, [userId, parseInt(limit), parseInt(offset)], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        const total = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as total 
                FROM Resenas 
                WHERE id_usuario = ?
            `, [userId], (err, row) => {
                if (err) reject(err);
                resolve(row.total);
            });
        });

        res.status(200).json({
            resenas,
            total,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (err) {
        handleDbError(res, err, 'Error al obtener las reseñas del usuario');
    }
};

// Helper para obtener el promedio de un profesional
async function getPromedioProfesional(id_profesional) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT AVG(calificacion) as promedio 
            FROM Resenas 
            WHERE id_profesional = ?
        `, [id_profesional], (err, row) => {
            if (err) reject(err);
            resolve(row.promedio || 0);
        });
    });
}

// Helper para obtener el total de reseñas de un profesional
async function getTotalResenias(id_profesional) {
    return new Promise((resolve, reject) => {
        db.get(`
            SELECT COUNT(*) as total 
            FROM Resenas 
            WHERE id_profesional = ?
        `, [id_profesional], (err, row) => {
            if (err) reject(err);
            resolve(row.total || 0);
        });
    });
}

// Obtener las últimas 3 reseñas y el total de reseñas de un profesional
exports.getProfessionalReviewsSummary = async (req, res) => {
    const { id } = req.params;

    try {
        // Verificar que el profesional existe
        const profesional = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Profesionales WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado' });
        }

        // Obtener las últimas 3 reseñas
        const ultimasResenas = await new Promise((resolve, reject) => {
            db.all(`
                SELECT 
                    r.*, 
                    u.nombre as usuario_nombre, 
                    u.foto_perfil as usuario_foto,
                    s.id as servicio_id,
                    s.fecha_servicio as servicio_fecha
                FROM Resenas r
                JOIN usuarios u ON r.id_usuario = u.id
                LEFT JOIN Servicios s ON r.id_servicio = s.id
                WHERE r.id_profesional = ?
                ORDER BY r.fecha_creacion DESC
                LIMIT 3
            `, [id], (err, rows) => {
                if (err) reject(err);
                resolve(rows);
            });
        });

        // Obtener el conteo total de reseñas
        const totalResenas = await new Promise((resolve, reject) => {
            db.get(`
                SELECT COUNT(*) as total 
                FROM Resenas 
                WHERE id_profesional = ?
            `, [id], (err, row) => {
                if (err) reject(err);
                resolve(row.total);
            });
        });

        // Obtener el promedio de calificaciones
        const promedioCalificacion = await getPromedioProfesional(id);

        res.status(200).json({
            ultimas_resenas: ultimasResenas,
            total_resenas: totalResenas,
            promedio_calificacion: promedioCalificacion,
            profesional: {
                id: id,
                promedio_calificacion: promedioCalificacion,
                total_resenias: totalResenas
            }
        });

    } catch (err) {
        handleDbError(res, err, 'Error al obtener el resumen de reseñas');
    }
};