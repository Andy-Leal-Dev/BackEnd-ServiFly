// professionalController.js
// professionalController.js
const db = require('../db/users');
const fs = require('fs');
const path = require('path');

// Configuración de la carpeta de uploads para KYC
const KYC_UPLOADS_DIR = path.join(__dirname, '../uploads/kyc');
if (!fs.existsSync(KYC_UPLOADS_DIR)) {
    fs.mkdirSync(KYC_UPLOADS_DIR, { recursive: true });
}

// Helper para manejar errores de la base de datos
const handleDbError = (res, err, message = 'Error en la base de datos') => {
    console.error(err);
    return res.status(500).json({ error: message, details: err.message });
};

// 1. Obtener lista de oficios y especialidades disponibles
exports.getProfessionsAndSpecialties = (req, res) => {
    const professions = [
        'Plomero', 'Electricista', 'Carpintero', 'Jardinero', 'Albañil', 
        'Pintor', 'Mecánico', 'Técnico Informático', 'Desarrollador de Software',
        'Soporte Técnico', 'Redes y Telecomunicaciones', 'Diseñador Gráfico',
        'Instalador de CCTV', 'Soldador', 'Cerrajero', 'Montador de Muebles',
        'Limpieza', 'Mudanzas', 'Fontanero', 'Reparador de Electrodomésticos'
    ];

    const specialties = [
        'Reparaciones', 'Instalaciones', 'Mantenimiento', 'Emergencias', 'Diseño',
        'Asesoría', 'Renovaciones', 'Programación', 'Desarrollo Web', 'Desarrollo de Apps',
        'Ciberseguridad', 'Soporte Remoto', 'Configuración de Redes', 'Instalación de Software',
        'Recuperación de Datos', 'Optimización de Sistemas', 'Automatización',
        'Cableado Estructurado', 'Edición de Video', 'Fotografía'
    ];

    res.status(200).json({ professions, specialties });
};

// 2. Iniciar el proceso de conversión a profesional (Paso 1)
exports.startProfessionalSignup = (req, res) => {
    const userId = req.user.id;
    const { professions, specialties } = req.body;

    if (!professions || !Array.isArray(professions) || professions.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un oficio' });
    }

    db.get(`SELECT is_professional FROM usuarios WHERE id = ?`, [userId], (err, user) => {
        if (err) return handleDbError(res, err);
        if (user && user.is_professional) {
            return res.status(400).json({ error: 'El usuario ya es profesional' });
        }

        res.status(200).json({ 
            message: 'Paso 1 completado', 
            nextStep: '/professional/signup/step2',
            data: { professions, specialties }
        });
    });
};

    exports.completeProfessionalInfo = async (req, res) => {
    const userId = req.user.id;
    const {
        description,
        experience,
        education,
        certifications,
        ratePerHour,
        serviceRadius,
        availability,
        paymentMethods,
        professions,
        specialties
    } = req.body;

    // Validaciones mejoradas con mensajes más descriptivos
    if (!description) return res.status(400).json({ error: 'La descripción es requerida' });
    if (!experience) return res.status(400).json({ error: 'La experiencia es requerida' });
    if (!ratePerHour) return res.status(400).json({ error: 'La tarifa por hora es requerida' });
    if (!serviceRadius) return res.status(400).json({ error: 'El radio de servicio es requerido' });
    if (!availability) return res.status(400).json({ error: 'La disponibilidad es requerida' });
    if (!Array.isArray(paymentMethods) || paymentMethods.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un método de pago' });
    }
    if (!Array.isArray(professions) || professions.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos un oficio' });
    }
    if (!Array.isArray(specialties) || specialties.length === 0) {
        return res.status(400).json({ error: 'Debe seleccionar al menos una especialidad' });
    }

    const normalizedPaymentMethods = paymentMethods.map(m => m.toLowerCase());

    // Promisify helpers
    const dbGet = (sql, params) => new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
    });
    const dbAll = (sql, params) => new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
    const dbRun = (sql, params) => new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this);
        });
    });

    const insertMany = async (table, column, values, professionalId) => {
        if (!values || values.length === 0) return;
        const placeholders = values.map(() => '(?, ?)').join(',');
        const params = values.flatMap(val => [professionalId, val]);
        await dbRun(
            `INSERT INTO ${table} (id_profesional, ${column}) VALUES ${placeholders}`,
            params
        );
    };

    try {
        const user = await dbGet(`SELECT is_professional FROM usuarios WHERE id = ?`, [userId]);
        if (user && user.is_professional) {
            return res.status(400).json({ error: 'El usuario ya es profesional' });
        }

        await dbRun('BEGIN TRANSACTION');

        // Paso 1: Insertar profesional
        const profResult = await dbRun(
            `INSERT INTO Profesionales (
                id_usuario, descripcion, experiencia, educacion, 
                certificaciones, tarifa_por_hora, radio_servicio, disponibilidad
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId, description, experience, education,
                certifications, ratePerHour, serviceRadius, availability
            ]
        );
        const professionalId = profResult.lastID;

        // Paso 2: Actualizar usuario
        await dbRun(
            `UPDATE usuarios SET is_professional = 1, id_profesional = ? WHERE id = ?`,
            [professionalId, userId]
        );

        // Paso 3: Insertar métodos de pago
        await insertMany('Prof_MetodoPago', 'metodo_pago', normalizedPaymentMethods, professionalId);

        // Paso 4: Buscar ids de oficios
        const oficioRows = await dbAll(
            `SELECT id, nombre FROM Oficios WHERE nombre IN (${professions.map(() => '?').join(',')})`,
            professions
        );
        if (!oficioRows || oficioRows.length !== professions.length) {
            await dbRun('ROLLBACK');
            return res.status(400).json({ error: 'Uno o más oficios no existen' });
        }
        // Agregar los oficios seleccionados al profesional
        await insertMany('Prof_Oficio', 'id_oficio', oficioRows.map(r => r.id), professionalId);

        // Paso 5: Buscar ids de especialidades
        const espRows = await dbAll(
            `SELECT id, nombre FROM Especialidades WHERE nombre IN (${specialties.map(() => '?').join(',')})`,
            specialties
        );
        if (!espRows || espRows.length !== specialties.length) {
            await dbRun('ROLLBACK');
            return res.status(400).json({ error: 'Una o más especialidades no existen' });
        }
        await insertMany('Prof_Especialidad', 'id_especialidad', espRows.map(r => r.id), professionalId);

        await dbRun('COMMIT');
        res.status(200).json({
            message: 'Información profesional completada exitosamente',
            nextStep: '/professional/kyc',
            professionalId
        });
    } catch (err) {
        await dbRun('ROLLBACK').catch((err) => {
            console.error('Error en rollback:', err);
        });
        console.error('Error en registro profesional:', err);
        return handleDbError(res, err, 'Error al completar el registro profesional');
    }
};
  

// 4. Subir documentos KYC (verificación de identidad)
exports.uploadKYCDocuments = (req, res) => {
    const userId = req.user.id;
    // Multer guarda los archivos en req.files
    const idImageFile = req.files && req.files.idImage ? req.files.idImage[0] : null;
    const selfieImageFile = req.files && req.files.selfieImage ? req.files.selfieImage[0] : null;

    if (!idImageFile || !selfieImageFile) {
        return res.status(400).json({ error: 'Ambas imágenes son requeridas' });
    }

    // Guarda solo el nombre del archivo o la ruta relativa
    const idImagePath = path.relative(process.cwd(), idImageFile.path);
    const selfieImagePath = path.relative(process.cwd(), selfieImageFile.path);

    db.get(
        `SELECT p.id, p.is_verificado 
         FROM Profesionales p 
         JOIN usuarios u ON p.id_usuario = u.id 
         WHERE u.id = ?`,
        [userId],
        (err, professional) => {
            if (err) return handleDbError(res, err);
            if (!professional) {
                return res.status(400).json({ error: 'Primero complete el registro profesional' });
            }
            if (professional.is_verificado) {
                return res.status(400).json({ error: 'El profesional ya está verificado' });
            }

            db.run(
                `UPDATE Profesionales 
                 SET foto_identidad = ?, foto_selfie = ?, is_verificado = 1, fecha_verificacion = CURRENT_TIMESTAMP 
                 WHERE id = ?`,
                [idImagePath, selfieImagePath, professional.id],
                function(err) {
                    if (err) return handleDbError(res, err);

                    db.run(
                        `UPDATE usuarios SET is_verified = 1 WHERE id = ?`,
                        [userId],
                        function(err) {
                            if (err) return handleDbError(res, err);

                            res.status(200).json({ 
                                message: 'Documentos KYC subidos exitosamente',
                                isVerified: true
                            });
                        }
                    );
                }
            );
        }
    );
};


// 5. Obtener estado de verificación KYC
exports.getKYCStatus = (req, res) => {
    const userId = req.user.id;

    db.get(
        `SELECT p.is_verificado, p.fecha_verificacion, p.foto_identidad, p.foto_selfie
         FROM Profesionales p
         JOIN usuarios u ON p.id_usuario = u.id
         WHERE u.id = ?`,
        [userId],
        (err, result) => {
            if (err) return handleDbError(res, err);
            
            if (!result) {
                return res.status(200).json({ 
                    isProfessional: false,
                    isVerified: false 
                });
            }

            res.status(200).json({
                isProfessional: true,
                isVerified: result.is_verificado,
                verificationDate: result.fecha_verificacion,
                hasIdImage: !!result.foto_identidad,
                hasSelfieImage: !!result.foto_selfie
            });
        }
    );
};

exports.getList = (req, res) => {
    const query = `
        SELECT 
            u.id AS userId,
            u.nombre,
            u.email,
            u.telefono,
            u.foto_perfil AS userPhoto,
            p.id AS professionalId,
            p.descripcion,
            p.experiencia,
            p.educacion,
            p.certificaciones,
            p.tarifa_por_hora AS ratePerHour,
            p.radio_servicio AS serviceRadius,
            p.disponibilidad AS availability,
            p.promedio_calificacion AS averageRating,
            p.total_resenias AS totalReviews,
            p.is_verificado AS isVerified,
            GROUP_CONCAT(DISTINCT o.nombre) AS professions,
            GROUP_CONCAT(DISTINCT e.nombre) AS specialties,
            GROUP_CONCAT(DISTINCT mp.metodo_pago) AS paymentMethods
        FROM usuarios u
        JOIN Profesionales p ON u.id_profesional = p.id
        LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
        LEFT JOIN Oficios o ON po.id_oficio = o.id
        LEFT JOIN Prof_Especialidad pe ON p.id = pe.id_profesional
        LEFT JOIN Especialidades e ON pe.id_especialidad = e.id
        LEFT JOIN Prof_MetodoPago mp ON p.id = mp.id_profesional
        WHERE u.is_professional = 1
        GROUP BY u.id, p.id
    `;

    db.all(query, [], (err, rows) => {
        if (err) return handleDbError(res, err, 'Error obteniendo profesionales');
        
        const professionals = rows.map(row => {
            return {
                userId: row.userId,
                name: row.nombre,
                email: row.email,
                phone: row.telefono,
                userPhoto: row.userPhoto,
                professionalId: row.professionalId,
                description: row.descripcion,
                experience: row.experiencia,
                education: row.educacion,
                certifications: row.certificaciones,
                ratePerHour: row.ratePerHour,
                serviceRadius: row.serviceRadius,
                availability: row.availability,
                averageRating: row.averageRating,
                totalReviews: row.totalReviews,
                isVerified: row.isVerified,
                professions: row.professions ? row.professions.split(',') : [],
                specialties: row.specialties ? row.specialties.split(',') : [],
                paymentMethods: row.paymentMethods ? row.paymentMethods.split(',') : []
            };
        });

        res.status(200).json(professionals);
    });
};