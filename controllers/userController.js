const db = require('../models/users');
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
require('dotenv').config();
const JWT_SECRET = process.env.JWT_SECRET;
const bcrypt = require('bcrypt');

// Configuración de la carpeta de uploads
const UPLOADS_DIR = path.join(__dirname, '../uploads/profile');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Helper para manejar errores de la base de datos
const handleDbError = (res, err, message = 'Error en la base de datos') => {
    console.error(err);
    return res.status(500).json({ error: message });
};

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
}); 



// 1. Obtener perfil de usuario
exports.getProfile = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            nombre, telefono, email, foto_perfil, is_professional
        FROM Usuarios 
        WHERE id = ?
    `;

    db.get(query, [userId], (err, user) => {
        if (err) return handleDbError(res, err);
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

        res.status(200).json(user);
    });
};

exports.getMyProfileProfesional = (req, res) => {
    const userId = req.user.id;
    
    // Consulta para obtener toda la información del profesional
    const query = `
        SELECT
            Profesionales.*,
            Usuarios.nombre,
            Usuarios.email,
            Usuarios.telefono,
            Usuarios.foto_perfil,
            Usuarios.is_verified,
            Usuarios.id_profesional,
            GROUP_CONCAT(DISTINCT Oficios.nombre) AS oficios,
            GROUP_CONCAT(DISTINCT Especialidades.nombre) AS especialidades,
            GROUP_CONCAT(DISTINCT Prof_MetodoPago.metodo_pago) AS metodos_pago
        FROM
            Profesionales
        JOIN
            Usuarios ON Profesionales.id_usuario = Usuarios.id
        LEFT JOIN
            Prof_Oficio ON Profesionales.id = Prof_Oficio.id_profesional
        LEFT JOIN
            Oficios ON Prof_Oficio.id_oficio = Oficios.id
        LEFT JOIN
            Prof_Especialidad ON Profesionales.id = Prof_Especialidad.id_profesional
        LEFT JOIN
            Especialidades ON Prof_Especialidad.id_especialidad = Especialidades.id
        LEFT JOIN
            Prof_MetodoPago ON Profesionales.id = Prof_MetodoPago.id_profesional
        WHERE
            Profesionales.id_usuario = ?
        GROUP BY
            Profesionales.id;
    `;
    
    db.get(query, [userId], (err, professional) => {
        if (err) return handleDbError(res, err);
        if (!professional) return res.status(404).json({ error: 'Perfil profesional no encontrado' });
        
        // Formatear la respuesta
        const response = {
            id: professional.id,
            nombre: professional.nombre,
            email: professional.email,
            telefono: professional.telefono,
            foto_perfil: professional.foto_perfil,
            descripcion: professional.descripcion,
            experiencia: professional.experiencia,
            educacion: professional.educacion,
            certificaciones: professional.certificaciones,
            tarifa_por_hora: professional.tarifa_por_hora,
            radio_servicio: professional.radio_servicio,
            disponibilidad: professional.disponibilidad,
            promedio_calificacion: professional.promedio_calificacion,
            total_resenias: professional.total_resenias || 0,
            is_verificado: professional.is_verificado,
            fecha_verificacion: professional.fecha_verificacion,
            oficios: professional.oficios ? professional.oficios.split(',') : [],
            especialidades: professional.especialidades ? professional.especialidades.split(',') : [],
            metodos_pago: professional.metodos_pago ? professional.metodos_pago.split(',') : []
        };
        
        res.status(200).json(response);
    });
};

// Endpoint unificado para actualización de perfil (campos opcionales)
exports.updateProfile = async (req, res) => {
    const userId = req.user.id;
    if (!userId) {
        return res.status(400).json({ error: 'ID de usuario es requerido' });
    }

    // Get fields from multipart form data
    const { 
        nombre, 
        telefono,
        email, 
        currentPassword, 
        newPassword,
        confirmPassword
    } = req.body;

    try {
  
        // Get current user
        const currentUser = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM usuarios WHERE id = ?`, [userId], (err, row) => {
                if (err) reject(err);
                resolve(row || {});
            });
        });

        if (!currentUser.id) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        const updates = [];
        const params = [];
        let emailVerificationRequired = false;
        let verificationCode = null;
        let newEmail = null;

        // Handle name
        if (nombre !== undefined) {
            updates.push('nombre = ?');
            params.push(nombre);
        }

        // Handle phone
        if (telefono !== undefined) {
            updates.push('telefono = ?');
            params.push(telefono);
        }

        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ error: 'La contraseña actual es requerida' });
            }
            
            const isMatch = await bcrypt.compare(currentPassword, currentUser.password);
            if (!isMatch) {
                return res.status(400).json({ error: 'La contraseña actual es incorrecta' });
            }
            
            if (newPassword !== confirmPassword) {
                return res.status(400).json({ error: 'Las contraseñas no coinciden' });
            }

            const hashedPassword = await bcrypt.hash(newPassword, 10);
            updates.push('password = ?');
            params.push(hashedPassword);
        }

        // Handle email change (sección mejorada)
        if (email && email !== currentUser.email) {
            // Validar formato del email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                return res.status(400).json({ error: 'El formato del email no es válido' });
            }

            const emailExists = await new Promise((resolve, reject) => {
                db.get(
                    `SELECT id FROM usuarios WHERE email = ? AND id != ?`, 
                    [email, userId], 
                    (err, row) => {
                        if (err) reject(err);
                        resolve(!!row);
                    }
                );
            });

            if (emailExists) {
                return res.status(400).json({ error: 'Este email ya está registrado' });
            }

            verificationCode = Math.floor(100000 + Math.random() * 900000);
            emailVerificationRequired = true;
            newEmail = email;
            
            updates.push('codeverify = ?', 'emailverify = 0');
            params.push(verificationCode);
            
            
            try {
                // Envío del correo electrónico
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Código de verificación para cambio de email',
                    text: `Tu código de verificación es: ${verificationCode}`,
                    html: `<p>Tu código de verificación es: <strong>${verificationCode}</strong></p>`
                };

                await transporter.sendMail(mailOptions);
            } catch (emailError) {
                console.error('Error sending verification email:', emailError);
                return res.status(500).json({ error: 'Error al enviar el código de verificación' });
            }
        }

        // Handle profile photo
        let photoUrl = null;
        if (req.file) {
            const relativePath = `/uploads/profiles/${path.basename(req.file.path)}`;
            photoUrl = relativePath;
            
            // Delete old photo if exists
            if (currentUser.foto_perfil) {
                const oldPath = path.join(__dirname, '../', currentUser.foto_perfil);
                if (fs.existsSync(oldPath)) {
                    fs.unlinkSync(oldPath);
                }
            }
            
            updates.push('foto_perfil = ?');
            params.push(photoUrl);
        }

        // If nothing to update
        if (updates.length === 0 && !req.file) {
            return res.status(200).json({ 
                message: 'No se realizaron cambios', 
                user: currentUser 
            });
        }

        // Build and execute query
        const query = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`;
        params.push(userId);

        await new Promise((resolve, reject) => {
            db.run(query, params, (err) => {
                if (err) reject(err);
                resolve();
            });
        });

    

        // Get updated user (sin información sensible)
        const updatedUser = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, nombre, telefono, email, foto_perfil, emailverify 
                 FROM usuarios WHERE id = ?`, 
                [userId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        // Prepare response
        const response = {
            message: 'Perfil actualizado exitosamente',
            user: {
                ...updatedUser,
                // Mostrar el email actual hasta que se verifique el nuevo
                email: updatedUser.emailverify ? updatedUser.email : currentUser.email
            }
        };

        if (emailVerificationRequired) {
            response.message = 'Perfil actualizado. Se ha enviado un código de verificación a tu nuevo correo electrónico.';
            response.verificationRequired = true;
            // No enviamos el nuevo email en la respuesta por seguridad
        }

        res.status(200).json(response);

    } catch (err) {
        // Rollback en caso de error
        await new Promise((resolve, reject) => {
            db.run('ROLLBACK', (rollbackErr) => {
                if (rollbackErr) console.error('Error en rollback:', rollbackErr);
                resolve();
            });
        });

        // Cleanup if error occurs
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        console.error('Error updating profile:', err);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};
// Endpoint para verificar el código de email
exports.verifyEmailCode = async (req, res) => {
    const userId = req.user.id;
    const { code, newEmail } = req.body;

    if (!code || !newEmail) {
        return res.status(400).json({ 
            error: 'El código de verificación y nuevo email son requeridos' 
        });
    }

    try {
        // 1. Obtener los datos actuales del usuario
        const user = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, email, codeverify, emailverify 
                 FROM usuarios WHERE id = ?`, 
                [userId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row || {});
                }
            );
        });

        if (!user.id) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // 2. Verificar si hay un código de verificación pendiente
        if (!user.codeverify) {
            return res.status(400).json({ 
                error: 'No hay un cambio de email pendiente de verificación' 
            });
        }

        // 3. Comparar el código proporcionado con el almacenado
        if (user.codeverify !== parseInt(code)) {
            return res.status(400).json({ 
                error: 'Código de verificación incorrecto' 
            });
        }

        // 4. Verificar que el nuevo email coincide con lo que intentamos verificar
        // (En una implementación real, deberíamos tener este nuevo email almacenado temporalmente)
        // Por ahora solo verificamos que no sea igual al actual
        if (newEmail === user.email) {
            return res.status(400).json({ 
                error: 'El nuevo email no puede ser igual al actual' 
            });
        }

        // 5. Verificar que el nuevo email no esté en uso por otro usuario
        const emailExists = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM usuarios WHERE email = ? AND id != ?`, 
                [newEmail, userId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(!!row);
                }
            );
        });

        if (emailExists) {
            return res.status(400).json({ error: 'Este email ya está registrado' });
        }

        // 6. Actualizar el email y limpiar los campos de verificación
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE usuarios 
                 SET email = ?, codeverify = NULL, emailverify = 1 
                 WHERE id = ?`,
                [newEmail, userId],
                (err) => {
                    if (err) reject(err);
                    resolve();
                }
            );
        });

        // 7. Obtener el usuario actualizado para la respuesta
        const updatedUser = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, nombre, telefono, email, fecha_nacimiento, foto_perfil, emailverify 
                 FROM usuarios WHERE id = ?`, 
                [userId], 
                (err, row) => {
                    if (err) reject(err);
                    resolve(row);
                }
            );
        });

        res.status(200).json({
            message: 'Email verificado y actualizado exitosamente',
            user: updatedUser
        });

    } catch (err) {
        handleDbError(res, err);
    }
};
// 4. Obtener direcciones del usuario
exports.getAddresses = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            id, direccion, ciudad, provincia, codigo_postal, pais,
            ubicacion_lat, ubicacion_lng, is_principal
        FROM Direcciones 
        WHERE id_usuario = ?
        ORDER BY is_principal DESC, id ASC
    `;

    db.all(query, [userId], (err, addresses) => {
        if (err) return handleDbError(res, err);
        res.status(200).json(addresses);
    });
};

// 5. Agregar dirección
exports.addAddress = (req, res) => {
    const userId = req.user.id;
    const { 
        direccion, 
        ciudad, 
        provincia, 
        codigo_postal, 
        pais = 'Venezuela',
        ubicacion_lat, 
        ubicacion_lng,
        is_principal = false
    } = req.body;

    if (!direccion || !ciudad || !provincia) {
        return res.status(400).json({ error: 'Dirección, ciudad y provincia son requeridos' });
    }

    // Si se marca como principal, primero desmarcar cualquier otra dirección principal
    const updatePrincipalQuery = `
        UPDATE Direcciones 
        SET is_principal = 0 
        WHERE id_usuario = ? AND is_principal = 1
    `;

    const insertQuery = `
        INSERT INTO Direcciones (
            id_usuario, direccion, ciudad, provincia, codigo_postal, pais,
            ubicacion_lat, ubicacion_lng, is_principal
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    db.serialize(() => {
        if (is_principal) {
            db.run(updatePrincipalQuery, [userId], (err) => {
                if (err) return handleDbError(res, err);
            });
        }

        db.run(insertQuery, [
            userId, direccion, ciudad, provincia, codigo_postal || null, pais,
            ubicacion_lat || null, ubicacion_lng || null, is_principal ? 1 : 0
        ], function(err) {
            if (err) return handleDbError(res, err);

            // Obtener la dirección recién creada
            db.get(`SELECT * FROM Direcciones WHERE id = ?`, [this.lastID], (err, address) => {
                if (err) return handleDbError(res, err);

                res.status(201).json({
                    message: 'Dirección agregada exitosamente',
                    address
                });
            });
        });
    });
};

// 6. Actualizar dirección
exports.updateAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { 
        direccion, 
        ciudad, 
        provincia, 
        codigo_postal, 
        pais,
        ubicacion_lat, 
        ubicacion_lng,
        is_principal
    } = req.body;

    if (!direccion || !ciudad || !provincia) {
        return res.status(400).json({ error: 'Dirección, ciudad y provincia son requeridos' });
    }

    // Primero verificar que la dirección pertenece al usuario
    db.get(`SELECT id FROM Direcciones WHERE id = ? AND id_usuario = ?`, [id, userId], (err, row) => {
        if (err) return handleDbError(res, err);
        if (!row) return res.status(404).json({ error: 'Dirección no encontrada o no tienes permiso' });

        // Si se marca como principal, primero desmarcar cualquier otra dirección principal
        const updatePrincipalQuery = `
            UPDATE Direcciones 
            SET is_principal = 0 
            WHERE id_usuario = ? AND is_principal = 1 AND id != ?
        `;

        const updateQuery = `
            UPDATE Direcciones 
            SET 
                direccion = ?, 
                ciudad = ?, 
                provincia = ?, 
                codigo_postal = ?, 
                pais = ?,
                ubicacion_lat = ?, 
                ubicacion_lng = ?,
                is_principal = ?
            WHERE id = ?
        `;

        db.serialize(() => {
            if (is_principal) {
                db.run(updatePrincipalQuery, [userId, id], (err) => {
                    if (err) return handleDbError(res, err);
                });
            }

            db.run(updateQuery, [
                direccion, 
                ciudad, 
                provincia, 
                codigo_postal || null, 
                pais || 'Venezuela',
                ubicacion_lat || null, 
                ubicacion_lng || null,
                is_principal ? 1 : 0,
                id
            ], (err) => {
                if (err) return handleDbError(res, err);

                // Obtener la dirección actualizada
                db.get(`SELECT * FROM Direcciones WHERE id = ?`, [id], (err, address) => {
                    if (err) return handleDbError(res, err);

                    res.status(200).json({
                        message: 'Dirección actualizada exitosamente',
                        address
                    });
                });
            });
        });
    });
};

// 7. Eliminar dirección
exports.deleteAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar que la dirección pertenece al usuario
    db.get(`SELECT id FROM Direcciones WHERE id = ? AND id_usuario = ?`, [id, userId], (err, row) => {
        if (err) return handleDbError(res, err);
        if (!row) return res.status(404).json({ error: 'Dirección no encontrada o no tienes permiso' });

        db.run(`DELETE FROM Direcciones WHERE id = ?`, [id], (err) => {
            if (err) return handleDbError(res, err);

            res.status(200).json({ message: 'Dirección eliminada exitosamente' });
        });
    });
};

// 8. Obtener profesionales favoritos
exports.getFavorites = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            p.id,
            p.descripcion,
            p.tarifa_por_hora,
            p.promedio_calificacion,
            p.total_reseñas,
            u.nombre,
            u.apellido,
            u.foto_perfil,
            GROUP_CONCAT(DISTINCT o.nombre) AS oficios
        FROM Favoritos f
        JOIN Profesionales p ON f.id_profesional = p.id
        JOIN Usuarios u ON p.id_usuario = u.id
        LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
        LEFT JOIN Oficios o ON po.id_oficio = o.id
        WHERE f.id_usuario = ?
        GROUP BY p.id
        ORDER BY f.fecha_agregado DESC
    `;

    db.all(query, [userId], (err, favorites) => {
        if (err) return handleDbError(res, err);

        // Formatear los oficios como array
        const formattedFavorites = favorites.map(fav => ({
            ...fav,
            oficios: fav.oficios ? fav.oficios.split(',') : []
        }));

        res.status(200).json(formattedFavorites);
    });
};

// 9. Agregar profesional a favoritos
exports.addFavorite = (req, res) => {
    const userId = req.user.id;
    const { profesionalId } = req.params;

    // Verificar que el profesional existe
    db.get(`SELECT id FROM Profesionales WHERE id = ?`, [profesionalId], (err, row) => {
        if (err) return handleDbError(res, err);
        if (!row) return res.status(404).json({ error: 'Profesional no encontrado' });

        // Verificar si ya es favorito
        db.get(`SELECT id FROM Favoritos WHERE id_usuario = ? AND id_profesional = ?`, 
              [userId, profesionalId], (err, favorite) => {
            if (err) return handleDbError(res, err);
            if (favorite) return res.status(400).json({ error: 'Este profesional ya está en tus favoritos' });

            const insertQuery = `
                INSERT INTO Favoritos (id_usuario, id_profesional)
                VALUES (?, ?)
            `;

            db.run(insertQuery, [userId, profesionalId], function(err) {
                if (err) return handleDbError(res, err);

                res.status(201).json({ 
                    message: 'Profesional agregado a favoritos exitosamente',
                    id: this.lastID
                });
            });
        });
    });
};

// 10. Eliminar profesional de favoritos
exports.removeFavorite = (req, res) => {
    const userId = req.user.id;
    const { profesionalId } = req.params;

    db.run(`DELETE FROM Favoritos WHERE id_usuario = ? AND id_profesional = ?`, 
          [userId, profesionalId], function(err) {
        if (err) return handleDbError(res, err);
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Profesional no encontrado en tus favoritos' });
        }

        res.status(200).json({ message: 'Profesional eliminado de favoritos exitosamente' });
    });

}
// userController.js - Agregar este nuevo método

exports.updateUserLocation = async (req, res) => {
    const userId = req.user.id;
    const { latitud, longitud, precision } = req.body;

    // Validación de campos requeridos
    if (!latitud || !longitud) {
        return res.status(400).json({ 
            error: 'Latitud y longitud son requeridas',
            details: 'Debes proporcionar ambas coordenadas para actualizar la ubicación'
        });
    }

    try {
        // Verificar si ya existe una ubicación para este usuario
        const existingLocation = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id FROM UbicacionTiempoReal WHERE id_usuario = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        let query, params;
        let isNew = false;

        if (existingLocation) {
            // Actualizar ubicación existente
            query = `
                UPDATE UbicacionTiempoReal 
                SET latitud = ?, longitud = ?, precision = ?
                WHERE id_usuario = ?
            `;
            params = [latitud, longitud, precision || null, userId];
        } else {
            // Crear nueva ubicación
            query = `
                INSERT INTO UbicacionTiempoReal 
                (id_usuario, latitud, longitud, precision)
                VALUES (?, ?, ?, ?)
            `;
            params = [userId, latitud, longitud, precision || null];
            isNew = true;
        }

        // Ejecutar la consulta
        await new Promise((resolve, reject) => {
            db.run(query, params, (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Obtener los datos actualizados para la respuesta
        const updatedLocation = await new Promise((resolve, reject) => {
            db.get(
                `SELECT id, id_usuario, latitud, longitud, precision
                 FROM UbicacionTiempoReal 
                 WHERE id_usuario = ?`,
                [userId],
                (err, row) => err ? reject(err) : resolve(row)
            );
        });

        res.status(200).json({
            success: true,
            message: isNew ? 'Ubicación creada exitosamente' : 'Ubicación actualizada exitosamente',
            data: updatedLocation
        });

    } catch (error) {
        console.error('Error en updateUserLocation:', error);
        res.status(500).json({
            error: 'Error del servidor',
            details: 'No se pudo actualizar la ubicación',
            systemError: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}


// userController.js (nuevos métodos para direcciones guardadas)

// Obtener todas las direcciones guardadas del usuario
exports.getSavedAddresses = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            id, nombre, direccion, latitud, longitud, pais, is_principal,
            strftime('%Y-%m-%d %H:%M:%S', fecha_creacion) as fecha_creacion
        FROM UbicacionesGuardadas 
        WHERE id_usuario = ?
        ORDER BY is_principal DESC, fecha_creacion DESC
    `;

    db.all(query, [userId], (err, addresses) => {
        if (err) return handleDbError(res, err);
        
        // Formatear la respuesta para que coincida con la app Flutter
        const formattedAddresses = addresses.map(address => ({
            id: address.id,
            title: address.nombre,
            address: address.direccion,
            latitude: address.latitud,
            longitude: address.longitud,
            country: address.pais,
            isPrimary: address.is_principal === 1,
            createdAt: address.fecha_creacion
        }));

        res.status(200).json(formattedAddresses);
    });
};

// Agregar una nueva dirección guardada
exports.addSavedAddress = (req, res) => {
    const userId = req.user.id;
    const { 
        title: nombre, 
        address: direccion, 
        latitude: latitud, 
        longitude: longitud, 
        country: pais = 'Venezuela',
        isPrimary: is_principal = false
    } = req.body;

    // Validaciones básicas
    if (!nombre || !direccion || !latitud || !longitud) {
        return res.status(400).json({ 
            error: 'Nombre, dirección y coordenadas son requeridos',
            details: {
                missingFields: {
                    title: !nombre,
                    address: !direccion,
                    coordinates: !latitud || !longitud
                }
            }
        });
    }

    // Si se marca como principal, primero desmarcar cualquier otra dirección principal
    const updatePrincipalQuery = `
        UPDATE UbicacionesGuardadas 
        SET is_principal = 0 
        WHERE id_usuario = ? AND is_principal = 1
    `;

    const insertQuery = `
        INSERT INTO UbicacionesGuardadas (
            id_usuario, nombre, direccion, latitud, longitud, pais, is_principal
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    db.serialize(() => {
        if (is_principal) {
            db.run(updatePrincipalQuery, [userId], (err) => {
                if (err) return handleDbError(res, err);
            });
        }

        db.run(insertQuery, [
            userId, nombre, direccion, latitud, longitud, pais, is_principal ? 1 : 0
        ], function(err) {
            if (err) return handleDbError(res, err);

            // Obtener la dirección recién creada
            db.get(`
                SELECT id, nombre, direccion, latitud, longitud, pais, is_principal,
                       strftime('%Y-%m-%d %H:%M:%S', fecha_creacion) as fecha_creacion
                FROM UbicacionesGuardadas 
                WHERE id = ?
            `, [this.lastID], (err, address) => {
                if (err) return handleDbError(res, err);

                res.status(201).json({
                    message: 'Dirección guardada exitosamente',
                    address: {
                        id: address.id,
                        title: address.nombre,
                        address: address.direccion,
                        latitude: address.latitud,
                        longitude: address.longitud,
                        country: address.pais,
                        isPrimary: address.is_principal === 1,
                        createdAt: address.fecha_creacion
                    }
                });
            });
        });
    });
};

// Actualizar una dirección guardada
exports.updateSavedAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { 
        title: nombre, 
        address: direccion, 
        latitude: latitud, 
        longitude: longitud, 
        country: pais,
        isPrimary: is_principal
    } = req.body;

    // Validaciones básicas
    if (!nombre || !direccion || !latitud || !longitud) {
        return res.status(400).json({ 
            error: 'Nombre, dirección y coordenadas son requeridos',
            details: {
                missingFields: {
                    title: !nombre,
                    address: !direccion,
                    coordinates: !latitud || !longitud
                }
            }
        });
    }

    // Primero verificar que la dirección pertenece al usuario
    db.get(`
        SELECT id, is_principal 
        FROM UbicacionesGuardadas 
        WHERE id = ? AND id_usuario = ?
    `, [id, userId], (err, address) => {
        if (err) return handleDbError(res, err);
        if (!address) {
            return res.status(404).json({ 
                error: 'Dirección no encontrada o no tienes permiso' 
            });
        }

        // Si se marca como principal y no lo era antes, 
        // primero desmarcar cualquier otra dirección principal
        const updatePrincipalQuery = `
            UPDATE UbicacionesGuardadas 
            SET is_principal = 0 
            WHERE id_usuario = ? AND is_principal = 1 AND id != ?
        `;

        const updateQuery = `
            UPDATE UbicacionesGuardadas 
            SET 
                nombre = ?, 
                direccion = ?, 
                latitud = ?, 
                longitud = ?, 
                pais = ?,
                is_principal = ?
            WHERE id = ?
        `;

        db.serialize(() => {
            if (is_principal && !address.is_principal) {
                db.run(updatePrincipalQuery, [userId, id], (err) => {
                    if (err) return handleDbError(res, err);
                });
            }

            db.run(updateQuery, [
                nombre, 
                direccion, 
                latitud, 
                longitud, 
                pais || 'Venezuela',
                is_principal ? 1 : 0,
                id
            ], (err) => {
                if (err) return handleDbError(res, err);

                // Obtener la dirección actualizada
                db.get(`
                    SELECT id, nombre, direccion, latitud, longitud, pais, is_principal,
                           strftime('%Y-%m-%d %H:%M:%S', fecha_creacion) as fecha_creacion
                    FROM UbicacionesGuardadas 
                    WHERE id = ?
                `, [id], (err, updatedAddress) => {
                    if (err) return handleDbError(res, err);

                    res.status(200).json({
                        message: 'Dirección actualizada exitosamente',
                        address: {
                            id: updatedAddress.id,
                            title: updatedAddress.nombre,
                            address: updatedAddress.direccion,
                            latitude: updatedAddress.latitud,
                            longitude: updatedAddress.longitud,
                            country: updatedAddress.pais,
                            isPrimary: updatedAddress.is_principal === 1,
                            createdAt: updatedAddress.fecha_creacion
                        }
                    });
                });
            });
        });
    });
};

// Eliminar una dirección guardada
exports.deleteSavedAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar que la dirección pertenece al usuario
    db.get(`
        SELECT id, is_principal 
        FROM UbicacionesGuardadas 
        WHERE id = ? AND id_usuario = ?
    `, [id, userId], (err, address) => {
        if (err) return handleDbError(res, err);
        if (!address) {
            return res.status(404).json({ 
                error: 'Dirección no encontrada o no tienes permiso' 
            });
        }

        // Si es la dirección principal, no permitir eliminarla
        if (address.is_principal) {
            return res.status(400).json({ 
                error: 'No puedes eliminar tu dirección principal',
                details: 'Primero asigna otra dirección como principal'
            });
        }

        db.run(`DELETE FROM UbicacionesGuardadas WHERE id = ?`, [id], function(err) {
            if (err) return handleDbError(res, err);

            if (this.changes === 0) {
                return res.status(404).json({ 
                    error: 'Dirección no encontrada' 
                });
            }

            res.status(200).json({ 
                message: 'Dirección eliminada exitosamente',
                deletedId: id
            });
        });
    });
};

// Establecer una dirección como principal
exports.setAsPrimaryAddress = (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;

    // Verificar que la dirección pertenece al usuario
    db.get(`
        SELECT id 
        FROM UbicacionesGuardadas 
        WHERE id = ? AND id_usuario = ?
    `, [id, userId], (err, address) => {
        if (err) return handleDbError(res, err);
        if (!address) {
            return res.status(404).json({ 
                error: 'Dirección no encontrada o no tienes permiso' 
            });
        }

        db.serialize(() => {
            // Primero desmarcar todas las direcciones como principales
            db.run(`
                UPDATE UbicacionesGuardadas 
                SET is_principal = 0 
                WHERE id_usuario = ?
            `, [userId], (err) => {
                if (err) return handleDbError(res, err);
            });

            // Luego marcar la dirección seleccionada como principal
            db.run(`
                UPDATE UbicacionesGuardadas 
                SET is_principal = 1 
                WHERE id = ?
            `, [id], function(err) {
                if (err) return handleDbError(res, err);

                res.status(200).json({ 
                    message: 'Dirección principal actualizada exitosamente',
                    primaryAddressId: id
                });
            });
        });
    });
};

// Obtener profesionales favoritos
exports.getFavorites = (req, res) => {
    const userId = req.user.id;

    const query = `
        SELECT 
            p.id AS professionalId,
            p.descripcion,
            p.tarifa_por_hora,
            p.promedio_calificacion,
            p.total_resenias,
            u.nombre,
            u.foto_perfil,
            GROUP_CONCAT(DISTINCT o.nombre) AS oficios,
            f.fecha_agregado
        FROM Favoritos f
        JOIN Profesionales p ON f.id_profesional = p.id
        JOIN usuarios u ON p.id_usuario = u.id
        LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
        LEFT JOIN Oficios o ON po.id_oficio = o.id
        WHERE f.id_usuario = ?
        GROUP BY p.id
        ORDER BY f.fecha_agregado DESC
    `;

    db.all(query, [userId], (err, favorites) => {
        if (err) return handleDbError(res, err);
        
        // Formatear los oficios como array
        const formattedFavorites = favorites.map(fav => ({
            ...fav,
            oficios: fav.oficios ? fav.oficios.split(',') : [],
            isFavorite: true // Siempre true ya que son los favoritos del usuario
        }));

        res.status(200).json(formattedFavorites);
    });
};

// Verificar si un profesional es favorito
exports.checkFavorite = (req, res) => {
    const userId = req.user.id;
    const { professionalId } = req.params;

    const query = `
        SELECT id 
        FROM Favoritos 
        WHERE id_usuario = ? AND id_profesional = ?
    `;

    db.get(query, [userId, professionalId], (err, row) => {
        if (err) return handleDbError(res, err);
        res.status(200).json({ isFavorite: !!row });
    });
};

// Agregar profesional a favoritos
exports.addFavorite = (req, res) => {
    const userId = req.user.id;
    const { professionalId } = req.params;

    // Verificar que el profesional existe
    db.get(`SELECT id FROM Profesionales WHERE id = ?`, [professionalId], (err, row) => {
        if (err) return handleDbError(res, err);
        if (!row) return res.status(404).json({ error: 'Profesional no encontrado' });

        // Verificar si ya es favorito
        db.get(`SELECT id FROM Favoritos WHERE id_usuario = ? AND id_profesional = ?`, 
              [userId, professionalId], (err, favorite) => {
            if (err) return handleDbError(res, err);
            if (favorite) return res.status(400).json({ error: 'Este profesional ya está en tus favoritos' });

            const insertQuery = `
                INSERT INTO Favoritos (id_usuario, id_profesional)
                VALUES (?, ?)
            `;

            db.run(insertQuery, [userId, professionalId], function(err) {
                if (err) return handleDbError(res, err);

                res.status(201).json({ 
                    message: 'Profesional agregado a favoritos exitosamente',
                    isFavorite: true
                });
            });
        });
    });
};

// Eliminar profesional de favoritos
exports.removeFavorite = (req, res) => {
    const userId = req.user.id;
    const { professionalId } = req.params;

    db.run(`DELETE FROM Favoritos WHERE id_usuario = ? AND id_profesional = ?`, 
          [userId, professionalId], function(err) {
        if (err) return handleDbError(res, err);
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Profesional no encontrado en tus favoritos' });
        }

        res.status(200).json({ 
            message: 'Profesional eliminado de favoritos exitosamente',
            isFavorite: false
        });
    });
};