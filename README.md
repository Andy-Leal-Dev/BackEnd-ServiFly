
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

## Autenticación (`/auth`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------|
| `POST` | `/registro`| Registro de nuevo usuario| `{ nombre, telefono, email, password, fecha_nacimiento }` | `{ message, usuario }` | - |
| `POST` | `/verifyCode`| Verificación de código de registro| `{ email, code }`| `{ message }`| - |
| `POST` | `/login`| Inicio de sesión| `{ email, password }`| `{ message, usuario, token }` | - |
| `POST` | `/emailsend` | Solicitud de recuperación de contraseña| `{ email }`| `{ message }`| - |
| `POST` | `/resetCode`      | Verificación de código de recuperación      | `{ email, code }`                              | `{ message }`             | - |
| `POST` | `/resetPassword`  | Restablecimiento de contraseña              | `{ email, newPassword }`                       | `{ message }`             | - |

## Usuarios (`/user`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------| 
| `GET`  | `/perfil`     | Obtener perfil básico| -| `Perfil básico`                     | - |
| `GET`  | `/perfil/profesional`| Obtener perfil profesional| -| `Perfil profesional completo`| - |
| `PUT`  | `/updateprofile` | Actualizar perfil| Multipart (campos opcionales + foto)| `{ message, user }`| - |
| `POST` | `/verify-email-code`| Verificar cambio de email| `{ code, newEmail }`| `{ message, user }`| - |
| `POST` | `/ubicacion`| Actualizar ubicación| `{ latitud, longitud, precision }`| `{ success, message, data }`| - |
| `GET`  | `/direcciones`| Obtener direcciones| -| `Array de direcciones`| - |
| `POST` | `/direcciones`| Agregar dirección| `{ title, address, latitude, longitude, country }` | `{ message, address }`| - |
| `PUT`  | `/direcciones/:id`| Actualizar dirección| `{ title, address, latitude, longitude, country, isPrimary }` | `{ message, address }` | - |
| `DELETE`| `/direcciones/:id`| Eliminar dirección| -| `{ message, deletedId }`| - |
| `PUT`  | `/direcciones/:id/set-principal`| Establecer dirección principal | -| `{ message, primaryAddressId }`     | - |
| `GET`  | `/favoritos`| Obtener favoritos| -| `Array de profesionales favoritos`  | - |
| `GET`  | `/favoritos/:professionalId/check`| Verificar favorito  | -| `{ isFavorite }` | - |
| `POST` | `/favoritos/:professionalId`| Agregar favorito | -| `{ message, isFavorite }`| - |
| `DELETE`| `/favoritos/:professionalId`| Eliminar favorito| -| `{ message, isFavorite }`| - |

## Profesionales (`/professional`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------|
| `GET`  | `/professions`                         | Obtener lista de oficios                        | -                                              | `{ professions }`                   | No            |
| `GET`  | `/professions-specialties`             | Obtener oficios y especialidades               | -                                              | `{ professions, specialties }`      | No            |
| `POST` | `/signup/step1`                        | Paso 1: Selección de oficios y especialidades   | `{ professions, specialties }`                 | `{ message, nextStep, data }`       | Sí            |
| `POST` | `/signup/step2`                        | Paso 2: Completar información profesional       | `{ description, experience, education, certifications, ratePerHour, serviceRadius, availability, paymentMethods }` | `{ message, nextStep, professionalId }` | Sí |
| `POST` | `/kyc/upload`                          | Subir documentos KYC                            | Multipart (idImage, selfieImage)               | `{ message, isVerified }`           | Sí            |
| `GET`  | `/kyc/status`                          | Obtener estado de verificación KYC              | -                                              | `{ isProfessional, isVerified, ... }` | Sí        |
| `POST` | `/update/location`                     | Actualizar ubicación profesional                | `{ latitud, longitud, estado_activo }`         | `{ success, message, data }`        | Sí            |
| `GET`  | `/list`                                | Obtener todos los profesionales                 | -                                              | `Lista de profesionales`            | No            |
| `GET`  | `/list/by-profession/:profession`      | Obtener profesionales por oficio               | -                                              | `Lista de profesionales`            | No            |
| `GET`  | `/list/by-payment/:paymentMethod`      | Obtener profesionales por método de pago       | -                                              | `Lista de profesionales`            | No            |
| `GET`  | `/list/nearby`                         | Obtener profesionales cercanos                 | Query: `?radius=10` (radio en km)              | `Lista de profesionales`            | Sí            |
| `GET`  | `/ProList`                             | Obtener lista de profesionales (alternativa)    | -                                              | `Lista de profesionales`            | No            |
| `GET`  | `/get/:id`                             | Obtener profesional por ID                      | -                                              | `Detalles del profesional`          | No            |

## Reseñas (`/reviews`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------|
| `POST` | `/`                                    | Crear una nueva reseña                          | `{ id_profesional, calificacion, comentario, id_servicio }` | `{ message, resena, profesional }` | Sí            |
| `POST` | `/:id/respond`                         | Responder a una reseña                          | `{ respuesta }`                                 | `{ message, resena }`               | Sí            |
| `GET`  | `/professional/:id`                    | Obtener reseñas de un profesional               | Query: `?limit=10&offset=0`                    | `{ resenas, total, ... }`           | Sí            |
| `GET`  | `/user`                                | Obtener reseñas dejadas por el usuario          | Query: `?limit=10&offset=0`                    | `{ resenas, total, ... }`           | Sí            |
| `GET`  | `/:id/resenas/resumen`                 | Obtener resumen de reseñas de un profesional    | -                                              | `{ ultimas_resenas, total_resenas, promedio_calificacion, profesional }` | Sí |

## Servicios (`/services`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------|
| `POST` | `/create`                              | Crear un nuevo servicio                         | `{ id_profesional, fecha_servicio, hora_servicio, id_ubicacion, notas_adicionales }` | `{ message, servicio }` | Sí |
| `GET`  | `/:role`                               | Obtener servicios del usuario                   | `role` puede ser 'cliente' o 'profesional'     | `{ success, count, servicios }`     | Sí            |
| `GET`  | `/by/:id`                              | Obtener detalles de un servicio                 | -                                              | `{ servicio }`                      | Sí            |
| `PUT`  | `/:id/status`                          | Actualizar estado de un servicio                | `{ estado, motivo, precio }`                   | `{ message, servicio }`             | Sí            |
| `GET`  | `/history/inactive`                    | Obtener servicios inactivos (historial)         | -                                              | `{ success, count, services }`      | Sí            |
| `POST` | `/:id/complete-rate`                   | Calificar servicio completado                   | `{ serviceRating, professionalRating, comment }` | `{ success, message, data }`        | Sí            |

## Administración (`/admin`)

| Método | Endpoint      | Descripción   | Parámetros    | Respuestas    | Requiere Auth |
|--------|---------------|---------------|---------------|---------------|---------------|
| `GET`  | `/getClients`                          | Obtener todos los clientes                      | -                                              | `Lista de clientes`                 | Sí            |
| `GET`  | `/getPro`                              | Obtener todos los profesionales                 | -                                              | `Lista de profesionales`            | Sí            |
| `GET`  | `/checkBlocked`                        | Verificar si usuario está bloqueado             | -                                              | `{ isBlocked }`                     | Sí            |
| `PUT`  | `/blockUser`                           | Bloquear/desbloquear usuario                    | `{ userId, block }`                            | `{ message }`                       | Sí            |
| `GET`  | `/services`                            | Obtener servicios aceptados/completados         | -                                              | `Lista de servicios`                | Sí            |


# Descripción de Archivos Controladores

## `adminController.js`
Controlador para operaciones administrativas del sistema:
- **GetClients**: Obtiene todos los usuarios clientes registrados
- **GetProfesionales**: Recupera todos los profesionales con sus datos completos
- **isUserBlocked**: Verifica si un usuario está bloqueado
- **toggleUserBlock**: Activa/desactiva el bloqueo de un usuario
- **services**: Obtiene todos los servicios pendientes y completados
- *Propósito principal*: Gestionar usuarios, profesionales y servicios desde el rol de administrador

## `authController.js`
Controlador para autenticación y seguridad:
- **register**: Registra nuevos usuarios y envía código de verificación
- **verifyCode**: Valida códigos de registro/recuperación
- **login**: Gestiona el inicio de sesión y genera tokens JWT
- **forgotPassword**: Maneja solicitudes de recuperación de contraseña
- **resetPassword**: Actualiza contraseñas de usuarios
- *Propósito principal*: Gestionar todo el ciclo de autenticación y seguridad de usuarios

## `professionalController.js`
Controlador para operaciones de profesionales:
- **getProfessions**: Lista de oficios disponibles
- **startProfessionalSignup**: Inicia proceso de registro profesional
- **completeProfessionalInfo**: Completa información profesional
- **uploadKYCDocuments**: Gestiona subida de documentos de verificación
- **getProfessionalList**: Obtiene listado completo de profesionales
- **getNearbyProfessionals**: Busca profesionales cercanos
- *Propósito principal*: Gestionar todo el ciclo de vida de profesionales y sus operaciones

## `reviewController.js`
Controlador para gestión de reseñas:
- **createReview**: Crea nuevas reseñas de profesionales
- **respondToReview**: Permite a profesionales responder reseñas
- **getProfessionalReviews**: Obtiene reseñas de un profesional
- **getUserReviews**: Recupera reseñas hechas por un usuario
- **getProfessionalReviewsSummary**: Genera resumen estadístico de reseñas
- *Propósito principal*: Gestionar el sistema de valoraciones y reseñas de servicios

## `serviceController.js`
Controlador para operaciones de servicios:
- **createService**: Crea nuevos servicios solicitados
- **getUserServices**: Obtiene servicios asociados a un usuario
- **updateServiceStatus**: Actualiza estados de servicios (aceptado/completado)
- **getServiceById**: Recupera detalles de un servicio específico
- **rateServiceAndComplete**: Califica servicios completados
- *Propósito principal*: Gestionar todo el ciclo de vida de los servicios ofrecidos

## `userController.js`
Controlador para operaciones de usuarios:
- **getProfile**: Obtiene perfil básico de usuario
- **updateProfile**: Actualiza información de perfil
- **verifyEmailCode**: Valida cambios de email
- **updateUserLocation**: Gestiona ubicación en tiempo real
- **getSavedAddresses**: Maneja direcciones guardadas
- **getFavorites**: Gestiona profesionales favoritos
- *Propósito principal*: Gestionar todas las operaciones relacionadas con usuarios regulares