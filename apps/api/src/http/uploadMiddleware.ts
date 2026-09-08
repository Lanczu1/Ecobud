import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { randomUUID } from 'crypto';
import type { RequestHandler } from 'express';
import { HttpError } from './errorResponder';

// Temporary directory for multer file parsing before cloud storage / processing
const tmpUploadDirectory = path.join(os.tmpdir(), 'ecobud-uploads');

if (!fs.existsSync(tmpUploadDirectory)) {
  fs.mkdirSync(tmpUploadDirectory, { recursive: true });
}

// Temporary disk storage for incoming uploads (cleanly deleted after upload to Supabase)
const tempStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, tmpUploadDirectory);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = randomUUID();
    const rawExt = path.extname(file.originalname).toLowerCase();
    const safeExt = /^\.[a-z0-9]+$/i.test(rawExt) ? rawExt : '.bin';
    cb(null, `${file.fieldname}-${uniqueSuffix}${safeExt}`);
  },
});

export function matchesMediaSignature(bytes: Buffer, mime: string): boolean {
  if (mime === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if (mime === 'image/jpeg' || mime === 'image/jpg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (mime === 'image/webp') return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  if (mime === 'video/mp4' || mime === 'video/quicktime') return bytes.toString('ascii', 4, 8) === 'ftyp';
  if (mime === 'video/webm' || mime === 'video/x-matroska') return bytes.subarray(0, 4).equals(Buffer.from([26,69,223,163]));
  return false;
}

function secureUpload(options: multer.Options) {
  const parser = multer(options);
  const wrap = (handler: RequestHandler): RequestHandler => (req, res, next) => {
    handler(req, res, error => {
      const files = req.file ? [req.file] : Array.isArray(req.files) ? req.files : Object.values(req.files || {}).flat();
      const cleanup = () => { for (const file of files) void fs.promises.unlink(file.path).catch(() => {}); };
      res.once('finish', cleanup);
      res.once('close', cleanup);
      if (error) { cleanup(); next(error); return; }
      void (async () => {
        for (const file of files) {
          const handle = await fs.promises.open(file.path, 'r');
          try {
            const bytes = Buffer.alloc(16);
            const { bytesRead } = await handle.read(bytes, 0, 16, 0);
            if (!matchesMediaSignature(bytes.subarray(0, bytesRead), file.mimetype)) throw new HttpError(400, 'File contents do not match the declared media type.');
          } finally { await handle.close(); }
        }
      })().then(() => next(), error => { cleanup(); next(error); });
    });
  };
  return { single: (name: string) => wrap(parser.single(name)), fields: (fields: multer.Field[]) => wrap(parser.fields(fields)) };
}

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

// Match the storage bucket's 50MB limit before accepting a file.
export const uploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: mediaFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
});

// Challenge proof images (10MB)
export const challengeUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Gemini analysis images (10MB)
export const analyzeUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    files: 1,
    fields: 0,
    parts: 2, // Allow the parser to finish the single file; fields remain forbidden.
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Avatar images (5MB)
export const avatarUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});

// Event cover / banner images (10MB)
export const eventUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Event submission proof images (10MB)
export const eventSubmissionUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Redeem reward images (5MB)
export const redeemUploadMiddleware = secureUpload({
  storage: tempStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  },
});
