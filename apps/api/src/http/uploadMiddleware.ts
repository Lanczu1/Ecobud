import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Define the upload directory relative to the project root
const uploadDirectory = path.join(__dirname, '..', '..', 'uploads');

// Ensure directory exists
if (!fs.existsSync(uploadDirectory)) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure multer to accept only expected types if needed, but for now we accept all and rely on field names
export const uploadMiddleware = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit for videos
  }
});

const challengesUploadDirectory = path.join(uploadDirectory, 'Challenges');
if (!fs.existsSync(challengesUploadDirectory)) {
  fs.mkdirSync(challengesUploadDirectory, { recursive: true });
}

const challengeStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, challengesUploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const challengeUploadMiddleware = multer({
  storage: challengeStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for images
  }
});

const analyzingUploadDirectory = path.join(challengesUploadDirectory, 'AnalyzingImg');
if (!fs.existsSync(analyzingUploadDirectory)) {
  fs.mkdirSync(analyzingUploadDirectory, { recursive: true });
}

const analyzingStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, analyzingUploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'analyze-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const analyzeUploadMiddleware = multer({
  storage: analyzingStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

const avatarsUploadDirectory = path.join(uploadDirectory, 'Avatars');
if (!fs.existsSync(avatarsUploadDirectory)) {
  fs.mkdirSync(avatarsUploadDirectory, { recursive: true });
}

const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, avatarsUploadDirectory);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

export const avatarUploadMiddleware = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for avatars
  }
});
