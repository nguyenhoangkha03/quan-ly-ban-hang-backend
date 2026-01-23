import { Router } from 'express';
import contactController from '@controllers/contact.controller';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiter for contact form - 5 requests per 15 minutes
const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    message: {
        success: false,
        message: 'Bạn đã gửi quá nhiều tin nhắn. Vui lòng thử lại sau 15 phút.',
    },
    standardHeaders: true,
    legacyHeaders: false,
});

/**
 * @route   POST /api/contact
 * @desc    Submit contact form
 * @access  Public
 */
router.post('/', contactLimiter, contactController.submitContactForm);

export default router;
