import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Ensure upload directories exist
const uploadsDir = path.join(__dirname, '../../uploads');
const videosDir = path.join(uploadsDir, 'videos');
const thumbnailsDir = path.join(uploadsDir, 'thumbnails');

[videosDir, thumbnailsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Video upload configuration
const videoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, videosDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'video-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// Thumbnail upload configuration
const thumbnailStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, thumbnailsDir);
    },
    filename: (_req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'thumb-' + uniqueSuffix + path.extname(file.originalname));
    }
});

// File filter for videos (MP4 only)
const videoFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['video/mp4'];
    const allowedExts = ['.mp4'];

    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedMimes.includes(mimeType) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only MP4 video files are allowed!'));
    }
};

// File filter for thumbnails (images only)
const thumbnailFileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const allowedMimes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];

    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype;

    if (allowedMimes.includes(mimeType) && allowedExts.includes(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Only image files (JPG, PNG, WebP) are allowed for thumbnails!'));
    }
};

// Video upload middleware (max 50MB)
export const uploadVideo = multer({
    storage: videoStorage,
    fileFilter: videoFileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB
    }
});

// Thumbnail upload middleware (max 5MB)
export const uploadThumbnail = multer({
    storage: thumbnailStorage,
    fileFilter: thumbnailFileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    }
});
