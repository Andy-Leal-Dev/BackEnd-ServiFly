# BackEnd-ServiFly

Este es el backend del proyecto **ServiFly**, desarrollado con Node.js y SQLite.  
Aquí encontrarás la configuración básica para instalar, ejecutar y contribuir al proyecto.

---

## Instalación

1. Clona el repositorio:

```bash
git clone https://github.com/tu-usuario/BackEnd-ServiFly.git
cd BackEnd-ServiFly
```

1. Instala las dependencias

```bash
npm install
```

## Configuración

Crear un archivo .env en la raíz del proyecto con las siguientes variables

```bash
PORT=3000
JWT_SECRET=clave_super_segura
```

También asegúrate de que la base de datos SQLite exista en ./database/servifly.sqlite. 
Si no existe, se creará automáticamente al iniciar el servidor.

## Ejecutar el servidor

Para iniciar el servidor: 

```bash
npm start
```

Por defecto, corre en http://localhost:3000