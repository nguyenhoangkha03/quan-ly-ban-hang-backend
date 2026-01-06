// Configuration
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '5242880', 10); // 5MB default

// Validate file size
export function validateFileSize(size: number, maxSize?: number): boolean {
  const limit = maxSize || MAX_FILE_SIZE;
  return size > 0 && size <= limit;
}

export default {
  validateFileSize,
};
