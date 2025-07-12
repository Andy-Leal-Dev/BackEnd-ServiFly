const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, '../database/servifly.sqlite')

const db = new sqlite3.Database(dbPath, (err) => {
    if (err){
        console.error('Error al conectar a SQLite: ', err.message);
    }
    else{
        console.log('Conectado a la base de datos SQLite')
    }
});

db.serialize(() => {
 db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      fecha_nacimiento DATE,
      foto_perfil VARCHAR,
      fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultimo_login DATETIME,
      is_active BOOLEAN DEFAULT TRUE,
      is_professional BOOLEAN DEFAULT FALSE,
      id_profesional INTEGER,
      is_verified BOOLEAN DEFAULT FALSE,
      idgoogle INTEGER,
      codeverify INTEGER,
      emailverify INTEGER,
      is_blocked BOOLEAN DEFAULT FALSE,
      FOREIGN KEY (id_profesional) REFERENCES Profesionales(id)
    )
  `);
  
  // Verificar y agregar columna si no existe (para migraciones) ESTO ES OPCIONAL, andy elige tu si se mantiene esto o q
  db.get("PRAGMA table_info(usuarios)", (err, columns) => {
    const hasIsBlocked = columns.some(col => col.name === 'is_blocked');
    if (!hasIsBlocked) {
      db.run("ALTER TABLE usuarios ADD COLUMN is_blocked BOOLEAN DEFAULT FALSE");
    }
  });

  // Tabla para ubicación en tiempo real
  db.run(`
    CREATE TABLE IF NOT EXISTS UbicacionTiempoReal (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      precision REAL,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabla para ubicaciones guardadas de usuarios
  db.run(`
    CREATE TABLE IF NOT EXISTS UbicacionesGuardadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      direccion TEXT NOT NULL,
      latitud REAL NOT NULL,
      longitud REAL NOT NULL,
      pais TEXT DEFAULT 'Venezuela',
      is_principal BOOLEAN DEFAULT FALSE,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);
db.run(`
  CREATE TABLE IF NOT EXISTS Servicios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_cliente INTEGER NOT NULL,
    id_profesional INTEGER NOT NULL,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_servicio DATETIME NOT NULL,
    hora_servicio TEXT NOT NULL,
    id_ubicacion INTEGER,
    notas_adicionales TEXT,
    estado TEXT NOT NULL CHECK(estado IN ('pendiente', 'confirmado', 'en_progreso', 'completado', 'cancelado', 'rechazado')) DEFAULT 'pendiente',
    motivo_cancelacion TEXT,
    precio_total REAL,
    calificacion INTEGER CHECK(calificacion BETWEEN 1 AND 5 OR calificacion IS NULL),
    comentario_calificacion TEXT,
    fecha_finalizacion DATETIME,
    FOREIGN KEY (id_cliente) REFERENCES usuarios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_profesional) REFERENCES Profesionales(id) ON DELETE CASCADE,
    FOREIGN KEY (id_ubicacion) REFERENCES UbicacionesGuardadas(id) ON DELETE SET NULL
  )
`);

// Tabla para historial de cambios de estado
db.run(`
  CREATE TABLE IF NOT EXISTS ServicioHistorial (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_servicio INTEGER NOT NULL,
    estado_anterior TEXT,
    estado_nuevo TEXT NOT NULL,
    fecha_cambio DATETIME DEFAULT CURRENT_TIMESTAMP,
    motivo_cambio TEXT,
    id_usuario_cambio INTEGER, 
    FOREIGN KEY (id_servicio) REFERENCES Servicios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario_cambio) REFERENCES usuarios(id) ON DELETE SET NULL
  )
`);

// Tabla para mensajes relacionados con un servicio
db.run(`
  CREATE TABLE IF NOT EXISTS ServicioMensajes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_servicio INTEGER NOT NULL,
    id_usuario INTEGER NOT NULL,  
    mensaje TEXT NOT NULL,
    fecha_envio DATETIME DEFAULT CURRENT_TIMESTAMP,
    leido BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (id_servicio) REFERENCES Servicios(id) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id) ON DELETE CASCADE
  )
`);
  // Crear índice para búsquedas más rápidas
  db.run(`
    CREATE INDEX IF NOT EXISTS idx_ubicacion_usuario 
    ON UbicacionTiempoReal(id_usuario)
  `);

  db.run(`
    CREATE INDEX IF NOT EXISTS idx_ubicaciones_guardadas_usuario 
    ON UbicacionesGuardadas(id_usuario)
  `);

 
   db.run(`
    CREATE TABLE IF NOT EXISTS Profesionales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_usuario INTEGER UNIQUE NOT NULL,
      descripcion TEXT,
      experiencia TEXT,
      educacion TEXT,
      certificaciones TEXT,
      tarifa_por_hora REAL,
      radio_servicio INTEGER,
      disponibilidad TEXT,
      promedio_calificacion REAL DEFAULT 0,
      total_resenias INTEGER DEFAULT 0,
      is_verificado BOOLEAN DEFAULT FALSE,
      fecha_verificacion DATETIME,
      foto_identidad TEXT,
      foto_selfie TEXT,
      FOREIGN KEY (id_usuario) REFERENCES Usuarios(id) ON DELETE CASCADE
    )
  `);

  // Tabla Oficios
  db.run(`
    CREATE TABLE IF NOT EXISTS Oficios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      icono TEXT,
      is_active BOOLEAN DEFAULT TRUE
    )
  `, function(err) {
    if (!err) {
      // Insertar oficios solo si la tabla está vacía
      db.get("SELECT COUNT(*) as count FROM Oficios", (err, row) => {
        if (!err && row.count === 0) {
          const oficios = [
            'Plomero', 'Electricista', 'Carpintero', 'Jardinero', 'Albañil',
            'Pintor', 'Mecánico', 'Técnico Informático', 'Desarrollador de Software',
            'Soporte Técnico', 'Redes y Telecomunicaciones', 'Diseñador Gráfico',
            'Instalador de CCTV', 'Soldador', 'Cerrajero', 'Montador de Muebles',
            'Limpieza', 'Mudanzas', 'Fontanero', 'Reparador de Electrodomésticos'
          ];
          const stmt = db.prepare("INSERT INTO Oficios (nombre) VALUES (?)");
          oficios.forEach(oficio => stmt.run(oficio));
          stmt.finalize();
        }
      });
    }
  });

  // Tabla Especialidades
  db.run(`
    CREATE TABLE IF NOT EXISTS Especialidades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      is_active BOOLEAN DEFAULT TRUE
    )
  `, function(err) {
    if (!err) {
      // Insertar especialidades solo si la tabla está vacía
      db.get("SELECT COUNT(*) as count FROM Especialidades", (err, row) => {
        if (!err && row.count === 0) {
          const especialidades = [
            'Reparaciones', 'Instalaciones', 'Mantenimiento', 'Emergencias', 'Diseño',
            'Asesoría', 'Renovaciones', 'Programación', 'Desarrollo Web', 'Desarrollo de Apps',
            'Ciberseguridad', 'Soporte Remoto', 'Configuración de Redes', 'Instalación de Software',
            'Recuperación de Datos', 'Optimización de Sistemas', 'Automatización',
            'Cableado Estructurado', 'Edición de Video', 'Fotografía'
          ];
          const stmt = db.prepare("INSERT INTO Especialidades (nombre) VALUES (?)");
          especialidades.forEach(especialidad => stmt.run(especialidad));
          stmt.finalize();
        }
      });
    }
  });

  // Tabla Prof_Oficio
  db.run(`
    CREATE TABLE IF NOT EXISTS Prof_Oficio (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_profesional INTEGER NOT NULL,
      id_oficio INTEGER NOT NULL,
      anos_experiencia INTEGER,
      UNIQUE (id_profesional, id_oficio),
      FOREIGN KEY (id_profesional) REFERENCES Profesionales(id) ON DELETE CASCADE,
      FOREIGN KEY (id_oficio) REFERENCES Oficios(id)
    )
  `);

  // Tabla Prof_Especialidad
  db.run(`
    CREATE TABLE IF NOT EXISTS Prof_Especialidad (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_profesional INTEGER NOT NULL,
      id_especialidad INTEGER NOT NULL,
      UNIQUE (id_profesional, id_especialidad),
      FOREIGN KEY (id_profesional) REFERENCES Profesionales(id) ON DELETE CASCADE,
      FOREIGN KEY (id_especialidad) REFERENCES Especialidades(id)
    )
  `);

  // Tabla Prof_MetodoPago
  db.run(`
    CREATE TABLE IF NOT EXISTS Prof_MetodoPago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_profesional INTEGER NOT NULL,
      metodo_pago TEXT NOT NULL CHECK(metodo_pago IN ('efectivo', 'transferencia', 'tarjeta', 'paypal')),
      detalles TEXT,
      FOREIGN KEY (id_profesional) REFERENCES Profesionales(id) ON DELETE CASCADE
    )
  `);

 
});

module.exports = db;