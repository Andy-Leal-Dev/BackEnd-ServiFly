const multer = require('multer');
const path = require('path');

// Configurar almacenamiento para fotos de perfil
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads/kyc'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'kyc-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Filtrar solo imágenes (con más formatos admitidos)
const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        'image/jpg',       // JPG
        'image/jpeg',       // JPEG
        'image/png',        // PNG
        'image/gif',       // GIF
        'image/webp',      // WebP
        'image/svg+xml',    // SVG
        'image/bmp',       // BMP
        'image/tiff',      // TIFF
        'image/x-icon',     // ICO
        'image/vnd.microsoft.icon' // Iconos Windows
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP, SVG, BMP, TIFF, ICO)'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    }
});

module.exports = upload;