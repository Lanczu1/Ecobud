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
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// General upload middleware (e.g. for lessons with videos up to 100MB)
export const uploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB
  },
});

// Challenge proof images (10MB)
export const challengeUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// YOLO analysis images (10MB)
export const analyzeUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Avatar images (5MB)
export const avatarUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Event cover / banner images (10MB)
export const eventUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Event submission proof images (10MB)
export const eventSubmissionUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Redeem reward images (5MB)
export const redeemUploadMiddleware = multer({
  storage: tempStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
