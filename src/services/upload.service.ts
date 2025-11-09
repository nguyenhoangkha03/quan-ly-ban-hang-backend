import multer, { FileFilterCallback } from 'multer';
import { Request } from 'express';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { ValidationError } from '@utils/errors';

// Constants
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const AVATAR_DIR = path.join(UPLOAD_DIR, 'avatars');
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880');
const ALLOWED_FILE_TYPES = (
  process.env.ALLOWED_FILE_TYPES || 'image/jpeg,image/png,image/jpg,image/webp'
).split(',');

// Avatar dimensions
const AVATAR_SIZE = 200;

class UploadService {
  // Ensure upload directories exist
  async ensureUploadDirs() {
    try {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
      await fs.mkdir(AVATAR_DIR, { recursive: true });
    } catch (error) {
      console.error('Failed to create upload directories:', error);
    }
  }

  // Multer storage configuration
  getMulterStorage() {
    return multer.diskStorage({
      destination: async (_req, _file, cb) => {
        await this.ensureUploadDirs();
        cb(null, AVATAR_DIR);
      },
      filename: (_req, file, cb) => {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `avatar-${uniqueSuffix}${ext}`);
      },
    });
  }

  // File filter for validation
  fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
    if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new ValidationError(
          `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}`
        ) as any
      );
    }
  }

  // Multer upload middleware
  getUploadMiddleware() {
    return multer({
      storage: this.getMulterStorage(),
      limits: {
        fileSize: MAX_FILE_SIZE,
      },
      fileFilter: this.fileFilter,
    });
  }

  // Process avatar image (resize & optimize)
  async processAvatar(filePath: string, userId: number): Promise<string> {
    try {
      const ext = path.extname(filePath);
      const processedFilename = `user-${userId}-${Date.now()}${ext}`;
      const processedPath = path.join(AVATAR_DIR, processedFilename);

      // Resize and optimize image
      await sharp(filePath)
        .resize(AVATAR_SIZE, AVATAR_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toFile(processedPath);

      // Delete original file
      await this.deleteFile(filePath);

      // Return relative path for database
      return `/uploads/avatars/${processedFilename}`;
    } catch (error) {
      // Clean up files on error
      await this.deleteFile(filePath);
      throw new Error(`Failed to process avatar: ${error}`);
    }
  }

  // Delete file from filesystem
  async deleteFile(filePath: string): Promise<void> {
    try {
      const fullPath = filePath.startsWith('/uploads')
        ? path.join(process.cwd(), filePath)
        : filePath;

      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore error if file doesn't exist
      if ((error as any).code !== 'ENOENT') {
        console.error('Failed to delete file:', error);
      }
    }
  }

  // Delete avatar and return success
  async deleteAvatar(avatarUrl: string | null): Promise<void> {
    if (!avatarUrl) return;

    await this.deleteFile(avatarUrl);
  }

  // Validate file size manually (for better error messages)
  validateFileSize(file: Express.Multer.File): void {
    if (file.size > MAX_FILE_SIZE) {
      throw new ValidationError(
        `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }
  }

  // Get full file path
  getFullPath(relativePath: string): string {
    return path.join(process.cwd(), relativePath);
  }

  // Check if file exists
  async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  // Get file info
  async getFileInfo(filePath: string) {
    try {
      const stats = await fs.stat(filePath);
      return {
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
      };
    } catch (error) {
      throw new Error(`Failed to get file info: ${error}`);
    }
  }
}

export default new UploadService();
