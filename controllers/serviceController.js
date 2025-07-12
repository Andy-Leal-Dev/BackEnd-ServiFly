const db = require('../db/users');

// Helper para manejar errores de la base de datos
const handleDbError = (res, err, message = 'Error en la base de datos') => {
    console.error(err);
    return res.status(500).json({ error: message, details: err.message });
};

// Crear un nuevo servicio
exports.createService = async (req, res) => {
    const userId = req.user.id;
    const { 
        id_profesional, 
        fecha_servicio, 
        hora_servicio, 
        id_ubicacion, 
        notas_adicionales,
    } = req.body;

    // Validaciones básicas
    if (!id_profesional || !fecha_servicio || !hora_servicio || !id_ubicacion) {
        return res.status(400).json({ error: 'Datos incompletos' });
    }

    try {
        // Verificar que el profesional existe
        const profesional = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Profesionales WHERE id_usuario = ?', [id_profesional], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!profesional) {
            return res.status(404).json({ error: 'Profesional no encontrado' });
        }

        // Verificar que la ubicación pertenece al usuario
        const ubicacion = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM UbicacionesGuardadas WHERE id = ? AND id_usuario = ?', 
                  [id_ubicacion, userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!ubicacion) {
            return res.status(404).json({ error: 'Ubicación no encontrada o no pertenece al usuario' });
        }

        // Insertar el servicio
        const result = await new Promise((resolve, reject) => {
            const query = `
                INSERT INTO Servicios (
                    id_cliente, id_profesional, fecha_servicio, hora_servicio, 
                    id_ubicacion, notas_adicionales, precio_total
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `;
            
            db.run(query, [
                userId, id_profesional, fecha_servicio, hora_servicio, 
                id_ubicacion, notas_adicionales || null
            ], function(err) {
                if (err) reject(err);
                resolve(this);
            });
        });

        // Registrar el estado inicial en el historial
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ServicioHistorial (
                    id_servicio, estado_anterior, estado_nuevo, id_usuario_cambio
                ) VALUES (?, NULL, 'pendiente', ?)
            `, [result.lastID, userId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Obtener el servicio recién creado para la respuesta
        const servicio = await new Promise((resolve, reject) => {
            db.get(`
                SELECT s.*, ug.nombre as ubicacion_nombre, ug.direccion as ubicacion_direccion
                FROM Servicios s
                LEFT JOIN UbicacionesGuardadas ug ON s.id_ubicacion = ug.id
                WHERE s.id = ?
            `, [result.lastID], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.status(200).json(
            'Servicio creado exitosamente'
        );

    } catch (err) {
        handleDbError(res, err, 'Error al crear el servicio');
    }
};
exports.getUserServices = async (req, res) => {
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            error: 'No autenticado',
            message: 'Debe iniciar sesión para acceder a este recurso',
        });
    }

    const userId = req.user.id;
    const { role } = req.params;

    if (role !== 'cliente' && role !== 'profesional') {
        return res.status(400).json({
            success: false,
            error: 'Parámetro inválido',
            message: 'El rol debe ser "cliente" o "profesional"',
            received: role
        });
    }

    try {
        // Verificar que el usuario existe
        const usuarioExiste = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM usuarios WHERE id = ?', [userId], (err, row) => {
                if (err) return reject(err);
                resolve(!!row);
            });
        });

        if (!usuarioExiste) {
            return res.status(404).json({
                success: false,
                error: 'Usuario no encontrado',
                message: 'El usuario no existe en el sistema'
            });
        }

        if (role === 'profesional') {
            // Primero obtenemos el ID del profesional
            const profesional = await new Promise((resolve, reject) => {
                db.get('SELECT id FROM Profesionales WHERE id_usuario = ?', [userId], (err, row) => {
                    if (err) return reject(err);
                    resolve(row);
                });
            });

            if (!profesional) {
                return res.status(403).json({
                    success: false,
                    error: 'Acceso denegado',
                    message: 'El usuario no está registrado como profesional'
                });
            }

            // Consulta para servicios donde el profesional es el proveedor (solicitados a él)
            const queryServiciosProveedor = `
                SELECT 
                    s.id,
                    s.fecha_creacion,
                    s.fecha_servicio,
                    s.hora_servicio,
                    s.notas_adicionales,
                    s.estado,
                    s.motivo_cancelacion,
                    s.id_cliente,
                    s.id_profesional,
                    u.nombre AS cliente_nombre,
                    u.foto_perfil AS cliente_foto,
                    p.descripcion AS profesional_descripcion,
                    GROUP_CONCAT(DISTINCT o.nombre) AS oficios,
                    COALESCE(ug.nombre, 'No especificada') AS ubicacion_nombre,
                    COALESCE(ug.direccion, 'No especificada') AS ubicacion_direccion,
                    'proveedor' AS tipo_servicio
                FROM Servicios s
                JOIN usuarios u ON s.id_cliente = u.id
                JOIN Profesionales p ON s.id_profesional = p.id_usuario
                LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
                LEFT JOIN Oficios o ON po.id_oficio = o.id
                LEFT JOIN UbicacionesGuardadas ug ON s.id_ubicacion = ug.id
                WHERE s.id_profesional = ?
                GROUP BY s.id
            `;

            // Consulta para servicios donde el profesional es el cliente (solicitados por él)
            const queryServiciosCliente = `
                SELECT 
                    s.id,
                    s.fecha_creacion,
                    s.fecha_servicio,
                    s.hora_servicio,
                    s.notas_adicionales,
                    s.estado,
                    s.motivo_cancelacion,
                    s.id_cliente,
                    s.id_profesional,
                    p.descripcion AS profesional_descripcion,
                    u.nombre AS profesional_nombre,
                    u.foto_perfil AS profesional_foto,
                    GROUP_CONCAT(DISTINCT o.nombre) AS oficios,
                    COALESCE(ug.nombre, 'No especificada') AS ubicacion_nombre,
                    COALESCE(ug.direccion, 'No especificada') AS ubicacion_direccion,
                    'cliente' AS tipo_servicio
                FROM Servicios s
                JOIN Profesionales p ON s.id_profesional = p.id
                JOIN usuarios u ON p.id_usuario = u.id
                LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
                LEFT JOIN Oficios o ON po.id_oficio = o.id
                LEFT JOIN UbicacionesGuardadas ug ON s.id_ubicacion = ug.id
                WHERE s.id_cliente = ?
                GROUP BY s.id
            `;

            // Ejecutar ambas consultas en paralelo
            const [serviciosComoProveedor, serviciosComoCliente] = await Promise.all([
                new Promise((resolve, reject) => {
                    db.all(queryServiciosProveedor, [userId], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    });
                }),
                new Promise((resolve, reject) => {
                    db.all(queryServiciosCliente, [userId], (err, rows) => {
                        if (err) return reject(err);
                        resolve(rows || []);
                    });
                })
            ]);

            // Combinar y ordenar todos los servicios
            const todosServicios = [...serviciosComoProveedor, ...serviciosComoCliente].sort((a, b) => {
                const fechaA = new Date(`${a.fecha_servicio} ${a.hora_servicio}`);
                const fechaB = new Date(`${b.fecha_servicio} ${b.hora_servicio}`);
                return fechaB - fechaA;
            });

            // Formatear la respuesta según el tipo de servicio
            const serviciosFormateados = todosServicios.map(servicio => {
                if (servicio.tipo_servicio === 'proveedor') {
                    return {
                        id: servicio.id,
                        fecha_creacion: servicio.fecha_creacion,
                        fecha_servicio: servicio.fecha_servicio,
                        hora_servicio: servicio.hora_servicio,
                        notas_adicionales: servicio.notas_adicionales,
                        estado: servicio.estado,
                        motivo_cancelacion: servicio.motivo_cancelacion,
                        cliente: {
                            id: servicio.id_cliente,
                            nombre: servicio.cliente_nombre,
                            foto: servicio.cliente_foto
                        },
                        profesional: {
                            id: servicio.id_profesional,
                            descripcion: servicio.profesional_descripcion,
                            oficios: servicio.oficios ? servicio.oficios.split(',') : []
                        },
                        ubicacion: {
                            nombre: servicio.ubicacion_nombre,
                            direccion: servicio.ubicacion_direccion
                        },
                        tipo: 'proveedor'
                    };
                } else {
                    return {
                        id: servicio.id,
                        fecha_creacion: servicio.fecha_creacion,
                        fecha_servicio: servicio.fecha_servicio,
                        hora_servicio: servicio.hora_servicio,
                        notas_adicionales: servicio.notas_adicionales,
                        estado: servicio.estado,
                        motivo_cancelacion: servicio.motivo_cancelacion,
                        cliente: {
                            id: servicio.id_cliente
                        },
                        profesional: {
                            id: servicio.id_profesional,
                            nombre: servicio.profesional_nombre,
                            foto: servicio.profesional_foto,
                            descripcion: servicio.profesional_descripcion,
                            oficios: servicio.oficios ? servicio.oficios.split(',') : []
                        },
                        ubicacion: {
                            nombre: servicio.ubicacion_nombre,
                            direccion: servicio.ubicacion_direccion
                        },
                        tipo: 'cliente'
                    };
                }
            });

            return res.status(200).json({
                success: true,
                count: serviciosFormateados.length,
                servicios: serviciosFormateados
            });

        } else {
            // Consulta para clientes - Versión con consultas separadas
            const serviciosCliente = await new Promise((resolve, reject) => {
                db.all(`
                    SELECT 
                        s.id,
                        s.fecha_creacion,
                        s.fecha_servicio,
                        s.hora_servicio,
                        s.notas_adicionales,
                        s.estado,
                        s.motivo_cancelacion,
                        s.id_profesional,
                        s.id_cliente,
                        ug.nombre AS ubicacion_nombre,
                        ug.direccion AS ubicacion_direccion
                    FROM Servicios s
                    LEFT JOIN UbicacionesGuardadas ug ON s.id_ubicacion = ug.id
                    WHERE s.id_cliente = ?
                    ORDER BY s.fecha_servicio DESC, s.hora_servicio DESC
                `, [userId], (err, rows) => {
                    if (err) return reject(err);
                    resolve(rows || []);
                });
            });

            if (serviciosCliente.length === 0) {
                return res.status(200).json({
                    success: true,
                    count: 0,
                    servicios: []
                });
            }

            // Para cada servicio, obtener la información del profesional en consulta separada
            const serviciosConProfesionales = await Promise.all(
                serviciosCliente.map(async (servicio) => {
                    const profesionalInfo = await new Promise((resolve, reject) => {
                        db.get(`
                            SELECT 
                                p.id,
                                p.descripcion,
                                u.nombre,
                                u.foto_perfil,
                                (SELECT GROUP_CONCAT(o.nombre) 
                                FROM Prof_Oficio po
                                JOIN Oficios o ON po.id_oficio = o.id
                                WHERE po.id_profesional = p.id) AS oficios
                            FROM Profesionales p
                            JOIN usuarios u ON p.id_usuario = u.id
                            WHERE u.id = ?
                        `, [servicio.id_profesional], (err, row) => {
                            if (err) return reject(err);
                            resolve(row || {
                                id: servicio.id_profesional,
                                nombre: 'Profesional no disponible',
                                foto_perfil: null,
                                descripcion: null,
                                oficios: null
                            });
                        });
                    });

                    return {
                        ...servicio,
                        profesional: {
                            id: profesionalInfo.id,
                            nombre: profesionalInfo.nombre,
                            foto: profesionalInfo.foto_perfil,
                            descripcion: profesionalInfo.descripcion,
                            oficios: profesionalInfo.oficios ? profesionalInfo.oficios.split(',') : []
                        },
                        cliente: {
                            id: servicio.id_cliente
                        }
                    };
                })
            );

            // Formatear la respuesta final
            const serviciosFormateados = serviciosConProfesionales.map(servicio => ({
                id: servicio.id,
                fecha_creacion: servicio.fecha_creacion,
                fecha_servicio: servicio.fecha_servicio,
                hora_servicio: servicio.hora_servicio,
                notas_adicionales: servicio.notas_adicionales,
                estado: servicio.estado,
                motivo_cancelacion: servicio.motivo_cancelacion,
                cliente: servicio.cliente,
                profesional: servicio.profesional,
                tipo: 'cliente',
                ubicacion: {
                    nombre: servicio.ubicacion_nombre,
                    direccion: servicio.ubicacion_direccion
                }
            }));

            return res.status(200).json({
                success: true,
                count: serviciosFormateados.length,
                servicios: serviciosFormateados
            });
        }

    } catch (err) {
        console.error('[getUserServices] Error:', err);
        return res.status(500).json({
            success: false,
            error: 'Error del servidor',
            message: 'Ocurrió un error al obtener los servicios',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};
// Actualizar estado de un servicio
exports.updateServiceStatus = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { estado, motivo } = req.body;

    // Validar estado
    const estadosPermitidos = ['pendiente', 'aceptado', 'completado', 'cancelado', 'rechazado'];
    if (!estadosPermitidos.includes(estado)) {
        return res.status(400).json({ error: 'Estado no válido' });
    }

    try {
        // Verificar que el servicio existe y obtener su estado actual
        const servicio = await new Promise((resolve, reject) => {
            db.get('SELECT estado, id_cliente, id_profesional FROM Servicios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!servicio) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        // Verificar permisos (solo cliente o profesional asociado pueden cambiar el estado)
        const profesional = await new Promise((resolve, reject) => {
            db.get('SELECT id FROM Profesionales WHERE id_usuario = ?', [userId], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        const puedeModificar = servicio.id_cliente === userId || 
                             (profesional && profesional.id === servicio.id_profesional);

        if (!puedeModificar) {
            return res.status(403).json({ error: 'No tienes permiso para modificar este servicio' });
        }

        // Actualizar el servicio
        await new Promise((resolve, reject) => {
            let query = 'UPDATE Servicios SET estado = ?';
            const params = [estado];

            // Si se completa o cancela, registrar fecha de finalización
            if (estado === 'completado' || estado === 'cancelado') {
                query += ', fecha_finalizacion = CURRENT_TIMESTAMP';
            }

            query += ' WHERE id = ?';
            params.push(id);

            db.run(query, params, (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Registrar en el historial
        await new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ServicioHistorial (
                    id_servicio, estado_anterior, estado_nuevo, 
                    motivo_cambio, id_usuario_cambio
                ) VALUES (?, ?, ?, ?, ?)
            `, [id, servicio.estado, estado, motivo || null, userId], (err) => {
                if (err) reject(err);
                resolve();
            });
        });


        // Obtener el servicio actualizado para la respuesta
        const servicioActualizado = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM Servicios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.status(200).json({
            message: 'Estado del servicio actualizado',
            servicio: servicioActualizado
        });

    } catch (err) {
        await new Promise((resolve) => {
            db.run('ROLLBACK', (rollbackErr) => {
                if (rollbackErr) console.error('Error en rollback:', rollbackErr);
                resolve();
            });
        });
        handleDbError(res, err, 'Error al actualizar el estado del servicio');
    }
};

// Obtener detalles de un servicio específico
exports.getServiceById = async (req, res) => {
    // Verificar autenticación
    if (!req.user || !req.user.id) {
        return res.status(401).json({
            success: false,
            error: 'No autenticado',
            message: 'Debe iniciar sesión para acceder a este recurso',
        });
    }

    const userId = req.user.id;
    const { id } = req.params;

    try {
        // 1. Obtener información básica del servicio
        const servicio = await new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    s.id,
                    s.fecha_creacion,
                    s.fecha_servicio,
                    s.hora_servicio,
                    s.notas_adicionales,
                    s.estado,
                    s.motivo_cancelacion,

                    s.id_cliente,
                    s.id_profesional,
                    s.id_ubicacion,
                    ug.nombre AS ubicacion_nombre,
                    ug.direccion AS ubicacion_direccion,
                    ug.latitud AS ubicacion_latitud,
                    ug.longitud AS ubicacion_longitud
                FROM Servicios s
                LEFT JOIN UbicacionesGuardadas ug ON s.id_ubicacion = ug.id
                WHERE s.id = ?
            `, [id], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        if (!servicio) {
            return res.status(404).json({
                success: false,
                error: 'Servicio no encontrado',
                message: 'El servicio solicitado no existe'
            });
        }

        // Verificar permisos
        const esCliente = servicio.id_cliente === userId;
        const esProfesional = servicio.id_profesional === userId;

        if (!esCliente && !esProfesional) {
            return res.status(403).json({
                success: false,
                error: 'Acceso denegado',
                message: 'No tienes permiso para ver este servicio'
            });
        }

        // 2. Obtener datos del cliente (en paralelo)
        const clientePromise = new Promise((resolve, reject) => {
            db.get(`
                SELECT id, nombre, foto_perfil AS foto
                FROM usuarios
                WHERE id = ?
            `, [servicio.id_cliente], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });

        // 3. Obtener datos del profesional (en paralelo)
        const profesionalPromise = new Promise((resolve, reject) => {
            db.get(`
                SELECT 
                    u.id,
                    p.descripcion,
                    p.tarifa_por_hora,
                    u.nombre,
                    u.foto_perfil AS foto,
                    GROUP_CONCAT(DISTINCT o.nombre) AS oficios
                FROM Profesionales p
                JOIN usuarios u ON p.id_usuario = u.id
                LEFT JOIN Prof_Oficio po ON p.id = po.id_profesional
                LEFT JOIN Oficios o ON po.id_oficio = o.id
                WHERE u.id = ?
                GROUP BY p.id
            `, [servicio.id_profesional], (err, row) => {
                if (err) return reject(err);
                resolve(row);
            });
        });
     
        // Esperar a que todas las consultas terminen
        const [cliente, profesional] = await Promise.all([clientePromise, profesionalPromise]);
   console.log('Servicio obtenido:', servicio);
        console.log('profeional', profesional)
        console.log('cliente', cliente)

        // Formatear la respuesta
        const respuesta = {
            success: true,
            servicio: {
                id: servicio.id,
                fecha_creacion: servicio.fecha_creacion,
                fecha_servicio: servicio.fecha_servicio,
                hora_servicio: servicio.hora_servicio,
                duracion_estimada: servicio.duracion_estimada,
                tarifa_total: servicio.tarifa_total,
                notas_adicionales: servicio.notas_adicionales,
                estado: servicio.estado,
                motivo_cancelacion: servicio.motivo_cancelacion,
                calificacion: servicio.calificacion,
                comentario_calificacion: servicio.comentario_calificacion,
                ubicacion: servicio.ubicacion_latitud && servicio.ubicacion_longitud ? {
                    nombre: servicio.ubicacion_nombre,
                    direccion: servicio.ubicacion_direccion,
                    latitud: servicio.ubicacion_latitud,
                    longitud: servicio.ubicacion_longitud
                } : null,
                cliente: {
                    id: cliente.id,
                    nombre: cliente.nombre,
                    foto: cliente.foto
                },
                profesional: {
                    id: profesional.id,
                    nombre: profesional.nombre,
                    foto: profesional.foto,
                    descripcion: profesional.descripcion,
                    tarifa_por_hora: profesional.tarifa_por_hora,
                    oficios: profesional.oficios ? profesional.oficios.split(',') : []
                },
                tipo: esCliente ? 'cliente' : 'proveedor'
            }
        };

        return res.status(200).json(respuesta);

    } catch (err) {
        console.error('[getServiceById] Error:', err);
        return res.status(500).json({
            success: false,
            error: 'Error del servidor',
            message: 'Ocurrió un error al obtener el servicio',
            details: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// Calificar un servicio completado
exports.rateService = async (req, res) => {
    const userId = req.user.id;
    const { id } = req.params;
    const { calificacion, comentario } = req.body;

    // Validar calificación
    if (!calificacion || calificacion < 1 || calificacion > 5) {
        return res.status(400).json({ error: 'La calificación debe ser entre 1 y 5' });
    }

    try {
        // Verificar que el servicio existe, está completado y pertenece al usuario
        const servicio = await new Promise((resolve, reject) => {
            db.get('SELECT id_cliente, estado FROM Servicios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        if (!servicio) {
            return res.status(404).json({ error: 'Servicio no encontrado' });
        }

        if (servicio.estado !== 'completado') {
            return res.status(400).json({ error: 'Solo se pueden calificar servicios completados' });
        }

        if (servicio.id_cliente !== userId) {
            return res.status(403).json({ error: 'Solo el cliente puede calificar este servicio' });
        }

        // Actualizar la calificación
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE Servicios 
                SET calificacion = ?, comentario_calificacion = ?
                WHERE id = ?
            `, [calificacion, comentario || null, id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Actualizar el promedio de calificaciones del profesional
        await new Promise((resolve, reject) => {
            db.run(`
                UPDATE Profesionales
                SET promedio_calificacion = (
                    SELECT AVG(calificacion) 
                    FROM Servicios 
                    WHERE id_profesional = (
                        SELECT id_profesional FROM Servicios WHERE id = ?
                    ) AND calificacion IS NOT NULL
                ),
                total_resenias = (
                    SELECT COUNT(*) 
                    FROM Servicios 
                    WHERE id_profesional = (
                        SELECT id_profesional FROM Servicios WHERE id = ?
                    ) AND calificacion IS NOT NULL
                )
                WHERE id = (
                    SELECT id_profesional FROM Servicios WHERE id = ?
                )
            `, [id, id, id], (err) => {
                if (err) reject(err);
                resolve();
            });
        });

        // Obtener el servicio actualizado para la respuesta
        const servicioActualizado = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM Servicios WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                resolve(row);
            });
        });

        res.status(200).json({
            message: 'Servicio calificado exitosamente',
            servicio: servicioActualizado
        });

    } catch (err) {
        handleDbError(res, err, 'Error al calificar el servicio');
    }
};