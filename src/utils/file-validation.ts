import { ValidationError } from './errors';
import path from 'path';
import fs from 'fs/promises';

/**
 * Enhanced File Upload Validation
 *
 * Validates file uploads with multiple security checks:
 * - File type validation (MIME type + extension)
 * - File size limits
 * - File content validation (magic bytes)
 * - Filename sanitization
 */

// Configuration
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB default
const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
const ALLOWED_DOCUMENT_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx'];

// MIME type to extension mapping
const MIME_TYPE_MAP: Record<string, string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'image/svg+xml': ['.svg'],
  'application/pdf': ['.pdf'],
  'application/msword': ['.doc'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.ms-excel': ['.xls'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
};

// Magic bytes for file type verification
const MAGIC_BYTES: Record<string, Buffer[]> = {
  jpg: [Buffer.from([0xff, 0xd8, 0xff])],
  png: [Buffer.from([0x89, 0x50, 0x4e, 0x47])],
  gif: [Buffer.from([0x47, 0x49, 0x46])],
  webp: [Buffer.from([0x52, 0x49, 0x46, 0x46])],
  pdf: [Buffer.from([0x25, 0x50, 0x44, 0x46])],
};

/**
 * Sanitize filename
 * Removes dangerous characters and prevents directory traversal
 *
 * @param filename - Original filename
 * @returns Sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  let sanitized = filename.replace(/[\/\\:\0]/g, '_');

  // Remove leading dots to prevent hidden files
  sanitized = sanitized.replace(/^\.+/, '');

  // Limit length
  const ext = path.extname(sanitized);
  const base = path.basename(sanitized, ext);

  if (base.length > 200) {
    sanitized = base.substring(0, 200) + ext;
  }

  // Remove special characters except basic ones
  sanitized = sanitized.replace(/[^a-zA-Z0-9._-]/g, '_');

  return sanitized;
}

/**
 * Validate file extension
 *
 * @param filename - Filename to validate
 * @param allowedExtensions - Array of allowed extensions
 * @returns true if valid
 */
export function validateFileExtension(filename: string, allowedExtensions: string[]): boolean {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.includes(ext);
}

/**
 * Validate MIME type
 *
 * @param mimetype - MIME type to validate
 * @param filename - Filename to validate
 * @returns true if MIME type matches file extension
 */
export function validateMimeType(mimetype: string, filename: string): boolean {
  const ext = path.extname(filename).toLowerCase();
  const allowedExtensions = MIME_TYPE_MAP[mimetype];

  if (!allowedExtensions) {
    return false;
  }

  return allowedExtensions.includes(ext);
}

/**
 * Validate file size
 *
 * @param size - File size in bytes
 * @param maxSize - Maximum allowed size (optional, uses default if not provided)
 * @returns true if valid
 */
export function validateFileSize(size: number, maxSize?: number): boolean {
  const limit = maxSize || MAX_FILE_SIZE;
  return size > 0 && size <= limit;
}

/**
 * Validate file content by checking magic bytes
 *
 * @param filePath - Path to file
 * @returns true if file content matches extension
 */
export async function validateFileContent(filePath: string): Promise<boolean> {
  try {
    const ext = path.extname(filePath).toLowerCase().substring(1);
    const expectedMagicBytes = MAGIC_BYTES[ext];

    if (!expectedMagicBytes) {
      // No magic bytes defined for this extension, skip check
      return true;
    }

    // Read first few bytes of file
    const fileHandle = await fs.open(filePath, 'r');
    const buffer = Buffer.alloc(8);
    await fileHandle.read(buffer, 0, 8, 0);
    await fileHandle.close();

    // Check if file starts with expected magic bytes
    return expectedMagicBytes.some((magic) => buffer.subarray(0, magic.length).equals(magic));
  } catch (error) {
    console.error('File content validation error:', error);
    return false;
  }
}

/**
 * Comprehensive file validation
 *
 * @param file - Multer file object
 * @param options - Validation options
 * @throws ValidationError if validation fails
 */
export async function validateUploadedFile(
  file: Express.Multer.File,
  options?: {
    allowedExtensions?: string[];
    maxSize?: number;
    checkContent?: boolean;
  }
): Promise<void> {
  const { allowedExtensions, maxSize, checkContent = true } = options || {};

  // Validate file size
  if (!validateFileSize(file.size, maxSize)) {
    const maxMB = (maxSize || MAX_FILE_SIZE) / 1024 / 1024;
    throw new ValidationError(`File size exceeds ${maxMB}MB limit`);
  }

  // Validate extension
  const extensions = allowedExtensions || ALLOWED_IMAGE_EXTENSIONS;
  if (!validateFileExtension(file.originalname, extensions)) {
    throw new ValidationError(
      `Invalid file type. Allowed types: ${extensions.join(', ')}`
    );
  }

  // Validate MIME type matches extension
  if (!validateMimeType(file.mimetype, file.originalname)) {
    throw new ValidationError('File type does not match file extension');
  }

  // Validate file content (magic bytes)
  if (checkContent && file.path) {
    const isValidContent = await validateFileContent(file.path);
    if (!isValidContent) {
      throw new ValidationError('File content validation failed. File may be corrupted or malicious.');
    }
  }
}

/**
 * Validate image file specifically
 *
 * @param file - Multer file object
 * @param maxSize - Maximum file size (optional)
 */
export async function validateImageFile(file: Express.Multer.File, maxSize?: number): Promise<void> {
  await validateUploadedFile(file, {
    allowedExtensions: ALLOWED_IMAGE_EXTENSIONS,
    maxSize,
    checkContent: true,
  });
}

/**
 * Validate document file
 *
 * @param file - Multer file object
 * @param maxSize - Maximum file size (optional)
 */
export async function validateDocumentFile(file: Express.Multer.File, maxSize?: number): Promise<void> {
  await validateUploadedFile(file, {
    allowedExtensions: ALLOWED_DOCUMENT_EXTENSIONS,
    maxSize,
    checkContent: true,
  });
}

/**
 * Check for potentially malicious filenames
 *
 * @param filename - Filename to check
 * @returns true if filename appears malicious
 */
export function isMaliciousFilename(filename: string): boolean {
  // Check for directory traversal attempts
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return true;
  }

  // Check for null bytes
  if (filename.includes('\0')) {
    return true;
  }

  // Check for script extensions
  const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.js', '.jsp', '.asp'];
  const ext = path.extname(filename).toLowerCase();
  if (dangerousExtensions.includes(ext)) {
    return true;
  }

  return false;
}

export default {
  sanitizeFilename,
  validateFileExtension,
  validateMimeType,
  validateFileSize,
  validateFileContent,
  validateUploadedFile,
  validateImageFile,
  validateDocumentFile,
  isMaliciousFilename,
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_DOCUMENT_EXTENSIONS,
  MAX_FILE_SIZE,
};
