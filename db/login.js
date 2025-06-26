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
      idgoogle INTEGER,
      emailverify INTEGER,
      FOREIGN KEY (id_profesional) REFERENCES Profesionales(id)
    )
  `);
});

module.exports = db;