import compression from 'compression';
import { Request, Response } from 'express';

// Bộ lọc nén - xác định xem phản hồi có nên được nén hay không
const shouldCompress = (req: Request, res: Response): boolean => {
  // Không nén nếu client nói rõ là không
  if (req.headers['x-no-compression']) {
    return false;
  }

  // Sử dụng bộ lọc mặc định nén
  return compression.filter(req, res);
};

// Xuất middleware nén được cấu hình
export const compressionMiddleware = compression({
  // Mức độ nén: 0 (không nén) đến 9 (nén tối đa)
  // Mức 6 là sự cân bằng tốt giữa tốc độ và tỷ số nén
  level: 6,

  // Chỉ nén các phản hồi lớn hơn 1KB
  threshold: 1024,

  // Bộ lọc tùy chỉnh
  filter: shouldCompress,

  // Kích thước khối để nén (mặc định là 16KB)
  chunkSize: 16 * 1024,

  // Mức bộ nhớ: 1-9 (cao hơn = nhiều bộ nhớ hơn, nén tốt hơn)
  memLevel: 8,

  // Chiến lược: Z_DEFAULT_STRATEGY, Z_FILTERED, Z_HUFFMAN_ONLY, Z_RLE, Z_FIXED
  strategy: 0, // Z_DEFAULT_STRATEGY
});

export default compressionMiddleware;
