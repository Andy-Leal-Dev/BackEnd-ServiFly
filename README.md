
# BackEnd-ServiFly

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![npm](https://img.shields.io/badge/npm-9+-blue.svg)](https://www.npmjs.com/)
[![Express](https://img.shields.io/badge/Express-4.x-lightgrey.svg)](https://expressjs.com/)
[![SQLite](https://img.shields.io/badge/SQLite-3.x-blue.svg)](https://www.sqlite.org/)

## Descripción del Proyecto

ServiFly es una plataforma que conecta clientes con profesionales de diversos oficios para la prestación de servicios. Este backend proporciona la API RESTful que soporta la aplicación móvil y web, manejando:

- Autenticación de usuarios
- Gestión de perfiles (clientes y profesionales)
- Catálogo de servicios
- Sistema de reseñas y valoraciones
- Mensajería en tiempo real
- Subida de documentos y fotos de perfil

## Estructura del Proyecto
```
BackEnd-ServiFly/
├── controllers/            # Lógica de negocio
│   ├── adminController.js
│   ├── authController.js
│   ├── professionalController.js
│   ├── reviewController.js
│   ├── serviceController.js
│   └── userController.js
├── database/              # Archivos de base de datos
│   └── servifly.sqlite
├── middlewares/           # Middlewares de Express
│   ├── authMiddleware.js
│   ├── blockedMiddleware.js
│   ├── uploadMiddleware.js
│   └── uploadProfileMiddleware.js
├── models/                # Modelos y conexión a DB
│   └── users.js
├── routes/                # Definición de rutas
│   ├── adminroutes.js
│   ├── authRoutes.js
│   ├── professionalRoutes.js
│   ├── reviewRoutes.js
│   ├── serviceRoutes.js
│   └── userRoutes.js
├── uploads/               # Archivos subidos
│   ├── kyc/               # Documentos de verificación
│   └── profiles/          # Fotos de perfil
├── .env                   # Variables de entorno
├── index.js               # Punto de entrada
└── README.md              # Documentación
```
## Tecnologías Utilizadas

| Tecnología       | Uso                                                                 |
|------------------|---------------------------------------------------------------------|
| **Node.js**      | Entorno de ejecución JavaScript                                     |
| **Express.js**   | Framework para construir la API REST                                |
| **SQLite**       | Base de datos relacional ligera                                     |
| **JWT**          | Autenticación mediante tokens                                       |
| **Socket.io**    | Comunicación en tiempo real para mensajería                         |
| **Multer**       | Manejo de uploads de archivos (documentos y fotos)                  |
| **Nodemailer**   | Envío de correos electrónicos (verificación, notificaciones)        |
| **Bcrypt**       | Hash seguro de contraseñas                                          |

##· Instalación

## Requisitos Previos

- Node.js (v18 o superior)
- npm (v9 o superior)
- SQLite3


## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/Andy-Leal-Dev/BackEnd-ServiFly.git
cd BackEnd-ServiFly
```

1. Instala las dependencias

```bash
npm install
```

## Ejecutar el servidor

Para iniciar el servidor: 

```bash
npm start o npm run dev
```
o
```bash
npm run dev
```
Por defecto, corre en http://localhost:3000
## Configuración del Entorno (.env)

### Configuración básica
- PORT=3000
### Autenticación
- JWT_SECRET=tu_clave_secreta_jwt

### Correo electrónico (para verificaciones)
- EMAIL_USER=tu_correo@gmail.com
- EMAIL_PASS=tu_contraseña_de_app

## Archivos Principales

### `index.js`
El punto de entrada principal de la aplicación que configura:
- Servidor Express con middlewares básicos
- Configuración de Socket.io para mensajería en tiempo real
- Rutas principales de la API
- Manejo de archivos estáticos (uploads)
- Conexión a la base de datos SQLite
- Sistema de mensajería con salas por servicio

### `models/users.js`
Configuración de la base de datos SQLite que incluye:
- Definición de todas las tablas del sistema:
  - Usuarios (clientes/profesionales)
  - Servicios y mensajes
  - Reseñas y favoritos
  - Oficios y especialidades
  - Ubicaciones y métodos de pago
- Relaciones entre tablas con claves foráneas
- Índices para optimización de consultas
- Datos iniciales para oficios y especialidades

### Middlewares

#### `authMiddleware.js`
Middleware de autenticación JWT que:
- Verifica tokens en las cabeceras Authorization
- Protege rutas privadas
- Añade información del usuario al request

#### `blockedMiddleware.js`
Middleware que verifica si un usuario está bloqueado:
- Consulta el estado del usuario en la base de datos
- Impide el acceso a usuarios bloqueados

#### `uploadMiddleware.js`
Configuración de Multer para subida de archivos:
- Manejo de documentos KYC (identificación)
- Validación de tipos de imagen (JPEG, PNG, etc.)
- Límite de tamaño de archivo (5MB)
- Almacenamiento en directorio `/uploads/kyc`

#### `uploadProfileMiddleware.js`
Configuración especializada para fotos de perfil:
- Crea directorio si no existe
- Genera nombres únicos para archivos
- Filtra formatos de imagen permitidos
- Configuración específica para campo 'photo'

# Especificación de API

## Autenticación (`auth/`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 
| :------| :-------| :-----------| :-------- | :--------- | 
| `POST` | `/registro` |Registro de nuevo usuario | `{ nombre, telefono, email, password, fecha_nacimiento }` | `	{ message, usuario}` | 
| `POST` | `/verifyCode` | Verificación de código de registro | `{ email, code }` | ` { message }` |
| `POST` | `/login` | Inicio de sesión | `{ email, password }` | `{ message, usuario, token }` | 
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `{ email }` | `{ message }` | 
| `POST` | `/resetCode` | Verificación de código de recuperación | `{ email, code }` | `{ message }` |
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `{ email, newPassword }` | `{ message }` | 


## Usuarios (`/user`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 
| :------| :-------| :-----------| :-------- | :--------- | 
| `GET` | `/perfil` |	Obtener perfil básico | `-` | `Perfil básico` |
| `GET` | `/perfil/profesional` | Obtener perfil profesional | `-` | `Perfil profesional completo` | 
| `PUT` | `/updateprofile` | 	Actualizar perfil | `Multipart (campos opcionales + foto)` | `{ message, user }` | 
| `POST` | `/verify-email-code` | Verificar cambio de email | `{ code, newEmail }` | `{ message, user }` | 
| `POST` | `/ubicacion` | Actualizar ubicación | `{ latitud, longitud, precision }` | `{ success, message, data }` |
| `GET` | `/direcciones` |	Obtener direcciones | `-` | `Array de direcciones` | 
| `POST` | `/direcciones` |Agregar dirección | `{ latitud, longitud, precision }` | `{ message, address }` | 
| `PUT` | `/direcciones/:id` | Actualizar dirección | `{ title, address, latitude, longitude, country, isPrimary }` | `{ message, address }` | 
| `DELETE` | `/direcciones/:id` | 	Eliminar dirección | `-` | `{ message, deletedId }` |
| `PUT` | `/direcciones/:id/set-principal` | Establecer dirección principal| `-` | `{ message, primaryAddressId }` | 
| `GET` | `/favoritos` | Obtener favoritos | `-` | `Array de profesionales favoritos` | 
| `GET` | `	/favoritos/:professionalId/check` | Verificar favorito | `-` | `	{ isFavorite }` | 
| `POST` | `	/favoritos/:professionalId` |	Agregar favorito| `-` | `{ message, isFavorite }` | 
| `DELETE` | `	/favoritos/:professionalId` | 	Eliminar favorito | `-` | `	{ message, isFavorite }` | 
  

## Profesionales (`/professional`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 	Requiere Auth  |
| :------| :-------| :-----------| :-------- | :--------- | :--------------- |
| `GET` | `/registro` |Registro de nuevo usuario | `api_key` | `string` |
| `POST` | `/verifyCode` | Verificación de código de registro | `api_key` | `string` | 
| `POST` | `/login` | Inicio de sesión | `api_key` | `string` |
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `api_key` | `string` | 
| `POST` | `/resetCode` | Verificación de código de recuperación | `api_key` | `string` | 
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` | 
| `POST` | `/registro` |Registro de nuevo usuario | `api_key` | `string` |
| `POST` | `/verifyCode` | Verificación de código de registro | `api_key` | `string` | 
| `POST` | `/login` | Inicio de sesión | `api_key` | `string` |
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `api_key` | `string` | 
| `POST` | `/resetCode` | Verificación de código de recuperación | `api_key` | `string` | 
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` |
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` |

## Reseñas (`/reviews`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 	Requiere Auth  |
| :------| :-------| :-----------| :-------- | :--------- | :--------------- |
| `POST` | `/registro` |Registro de nuevo usuario | `api_key` | `string` | 
| `POST` | `/verifyCode` | Verificación de código de registro | `api_key` | `string` | 
| `POST` | `/login` | Inicio de sesión | `api_key` | `string` | 
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `api_key` | `string` | 
| `POST` | `/resetCode` | Verificación de código de recuperación | `api_key` | `string` |
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` | 

## Servicios (`/services`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 	Requiere Auth  |
| :------| :-------| :-----------| :-------- | :--------- | :--------------- |
| `POST` | `/registro` |Registro de nuevo usuario | `api_key` | `string` | 
| `POST` | `/verifyCode` | Verificación de código de registro | `api_key` | `string` | 
| `POST` | `/login` | Inicio de sesión | `api_key` | `string` | 
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `api_key` | `string` |
| `POST` | `/resetCode` | Verificación de código de recuperación | `api_key` | `string` | 
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` | 


## Administración (`/admin`)


| Metodo | Enpoint | Descripcion |Parametros | Respuestas | 	Requiere Auth  |
| :------| :-------| :-----------| :-------- | :--------- | :--------------- |
| `POST` | `/registro` |Registro de nuevo usuario | `api_key` | `string` | 
| `POST` | `/verifyCode` | Verificación de código de registro | `api_key` | `string` | 
| `POST` | `/login` | Inicio de sesión | `api_key` | `string` | 
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña | `api_key` | `string` | 
| `POST` | `/resetCode` | Verificación de código de recuperación | `api_key` | `string` | 
| `POST` | `	/resetPassword` | Restablecimiento de contraseña | `api_key` | `string` | 
