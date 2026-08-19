import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Temporary directory for multer file parsing before cloud storage / processing
const tmpUploadDirectory = path.join(__dirname, '..', '..', 'uploads', 'tmp');

if (!fs.existsSync(tmpUploadDirectory)) {
  fs.mkdirSync(tmpUploadDirectory, { recursive: true });
}

// Temporary disk storage for incoming uploads (cleanly deleted after upload to Supabase)
const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpUploadDirectory);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = /^\.[a-z0-9]+$/i.test(rawExt) ? rawExt : '.bin';
    cb(null, `${file.fieldname}-${uniqueSuffix}${safeExt}`);
  },
});

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);
const ALLOWED_IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const ALLOWED_MEDIA_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-matroska',
]);
const ALLOWED_MEDIA_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4', '.mov', '.webm', '.mkv']);

const imageFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_IMAGE_MIMES.has(mime) && ALLOWED_IMAGE_EXTS.has(ext)) {
    return cb(null, true);
  }

  return cb(new Error('Invalid image file type. Only JPEG, PNG, and WebP images are allowed.'));
};

const mediaFileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mime = file.mimetype.toLowerCase();

  if (ALLOWED_MEDIA_MIMES.has(mime) && ALLOWED_MEDIA_EXTS.has(ext)) {
    return cb(null, true);
  }

  return cb(new Error('Invalid media file type. Only standard images and MP4/WebM videos are allowed.'));
};

// General upload middleware (e.g. for lessons with videos up to 100MB)
export const uploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Challenge proof images (10MB)
export const challengeUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// YOLO analysis images (10MB)
export const analyzeUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Avatar images (5MB)
export const avatarUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Event cover / banner images (10MB)
export const eventUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Event submission proof images (10MB)
export const eventSubmissionUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Redeem reward images (5MB)
export const redeemUploadMiddleware = multer({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
