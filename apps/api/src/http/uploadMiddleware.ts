import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Define the upload directory based on the user's requirement
const uploadDirectory = path.join('c:', 'xampp', 'htdocs', 'Ecobud', 'apps', 'web', 'uploads');

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
