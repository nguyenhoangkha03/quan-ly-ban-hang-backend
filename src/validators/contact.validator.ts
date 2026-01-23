import { z } from 'zod';

// Contact form validation schema
export const contactFormSchema = z.object({
    name: z
        .string()
        .min(2, 'Họ tên phải có ít nhất 2 ký tự')
        .max(100, 'Họ tên không được quá 100 ký tự')
        .trim(),
    email: z
        .string()
        .email('Email không hợp lệ')
        .max(255, 'Email không được quá 255 ký tự')
        .trim()
        .toLowerCase(),
    phone: z
        .string()
        .regex(/^0\d{9}$/, 'Số điện thoại phải có 10 số và bắt đầu bằng 0')
        .trim(),
    message: z
        .string()
        .min(10, 'Tin nhắn phải có ít nhất 10 ký tự')
        .max(1000, 'Tin nhắn không được quá 1000 ký tự')
        .trim(),
});

export type ContactFormData = z.infer<typeof contactFormSchema>;
