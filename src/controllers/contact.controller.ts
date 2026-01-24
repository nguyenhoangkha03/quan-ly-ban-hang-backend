import { Request, Response } from 'express';
import contactService from '@services/contact.service';
import { contactFormSchema } from '@validators/contact.validator';
import { logInfo, logError } from '@utils/logger';
import { ZodError } from 'zod';

class ContactController {
    /**
     * Submit contact form
     * @route POST /api/contact
     * @access Public
     */
    async submitContactForm(req: Request, res: Response): Promise<void> {
        try {
            // Validate request body
            const validatedData = contactFormSchema.parse(req.body);

            logInfo(`Contact form submission from: ${validatedData.email}`);

            // Send emails
            const emailsSent = await contactService.sendContactEmails(validatedData);

            if (emailsSent) {
                res.status(200).json({
                    success: true,
                    message: 'Tin nhắn của bạn đã được gửi thành công. Chúng tôi sẽ liên hệ lại sớm!',
                });
            } else {
                res.status(500).json({
                    success: false,
                    message: 'Có lỗi xảy ra khi gửi tin nhắn. Vui lòng thử lại sau hoặc liên hệ trực tiếp qua hotline.',
                });
            }
        } catch (error) {
            if (error instanceof ZodError) {
                // Validation error
                const firstError = error.issues[0];
                res.status(400).json({
                    success: false,
                    message: firstError.message,
                    errors: error.issues,
                });
            } else {
                // Server error
                logError('Error in submitContactForm:', error);
                res.status(500).json({
                    success: false,
                    message: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
                });
            }
        }
    }
}

export default new ContactController();
