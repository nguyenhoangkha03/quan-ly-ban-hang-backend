import emailService from './email.service';
import { logInfo, logError } from '@utils/logger';

interface ContactFormData {
    name: string;
    email: string;
    phone: string;
    message: string;
}

class ContactService {
    /**
     * Send contact form emails to both admin and customer
     */
    async sendContactEmails(data: ContactFormData): Promise<boolean> {
        try {
            logInfo(`Processing contact form submission from ${data.email}`);

            // Send both emails concurrently
            const [adminEmailSent, customerEmailSent] = await Promise.all([
                this.sendAdminNotification(data),
                this.sendCustomerConfirmation(data),
            ]);

            if (adminEmailSent && customerEmailSent) {
                logInfo(`Contact emails sent successfully for ${data.email}`);
                return true;
            } else {
                logError('Failed to send one or both contact emails');
                return false;
            }
        } catch (error) {
            logError('Error sending contact emails:', error);
            return false;
        }
    }

    /**
     * Send notification email to admin
     */
    private async sendAdminNotification(data: ContactFormData): Promise<boolean> {
        const adminEmail = process.env.COMPANY_EMAIL || 'hoasinhnamviet@gmail.com';
        const subject = `🔔 Tin nhắn mới từ khách hàng - ${data.name}`;
        const html = this.getAdminEmailTemplate(data);

        return await emailService.sendEmail({
            to: adminEmail,
            subject,
            html,
        });
    }

    /**
     * Send confirmation email to customer
     */
    private async sendCustomerConfirmation(data: ContactFormData): Promise<boolean> {
        const subject = '✅ Đã nhận được tin nhắn của bạn - Công Ty Nam Việt';
        const html = this.getCustomerEmailTemplate(data);

        return await emailService.sendEmail({
            to: data.email,
            subject,
            html,
        });
    }

    /**
     * Admin notification email template
     */
    private getAdminEmailTemplate(data: ContactFormData): string {
        return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tin nhắn mới từ khách hàng</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                                🔔 Tin Nhắn Mới
                            </h1>
                            <p style="margin: 10px 0 0 0; color: #dcfce7; font-size: 16px;">
                                Từ Website Liên Hệ
                            </p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
                                Bạn có tin nhắn mới từ khách hàng qua form liên hệ trên website:
                            </p>

                            <!-- Customer Info Card -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                                <tr>
                                    <td style="background-color: #f9fafb; border-left: 4px solid #22c55e; padding: 20px; border-radius: 4px;">
                                        <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #1f2937; font-size: 14px;">👤 Họ tên:</strong>
                                                    <span style="color: #4b5563; font-size: 14px; margin-left: 10px;">${data.name}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #1f2937; font-size: 14px;">📧 Email:</strong>
                                                    <a href="mailto:${data.email}" style="color: #22c55e; font-size: 14px; margin-left: 10px; text-decoration: none;">${data.email}</a>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 8px 0;">
                                                    <strong style="color: #1f2937; font-size: 14px;">📱 Số điện thoại:</strong>
                                                    <a href="tel:${data.phone}" style="color: #22c55e; font-size: 14px; margin-left: 10px; text-decoration: none;">${data.phone}</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>

                            <!-- Message Content -->
                            <div style="margin-bottom: 30px;">
                                <h3 style="margin: 0 0 15px 0; color: #1f2937; font-size: 18px; font-weight: 600;">
                                    💬 Nội dung tin nhắn:
                                </h3>
                                <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px;">
                                    <p style="margin: 0; color: #4b5563; font-size: 15px; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
                                </div>
                            </div>

                            <!-- Action Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 30px;">
                                <tr>
                                    <td align="center">
                                        <a href="mailto:${data.email}" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                                            📧 Trả Lời Ngay
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <!-- Alert -->
                            <div style="margin-top: 30px; padding: 15px; background-color: #fef3c7; border-left: 4px solid #f59e0b; border-radius: 4px;">
                                <p style="margin: 0; color: #92400e; font-size: 14px;">
                                    ⚠️ <strong>Lưu ý:</strong> Vui lòng liên hệ lại khách hàng trong vòng 24 giờ để đảm bảo chất lượng dịch vụ.
                                </p>
                            </div>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                                Email này được gửi tự động từ hệ thống
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} ${process.env.COMPANY_NAME || 'Công Ty Nam Việt'}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }

    /**
     * Customer confirmation email template
     */
    private getCustomerEmailTemplate(data: ContactFormData): string {
        const companyName = process.env.COMPANY_NAME || 'Công Ty Cổ Phần Hoá Sinh Nam Việt';
        const companyPhone = process.env.COMPANY_PHONE || '1800 66 25';
        const companyEmail = process.env.COMPANY_EMAIL || 'hoasinhnamviet@gmail.com';
        const companyAddress = process.env.COMPANY_ADDRESS || 'QL30/ấp Đông Mỹ, Mỹ Hội, Cao Lãnh, Đồng Tháp';

        return `
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Xác nhận tin nhắn</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td align="center" style="padding: 40px 0;">
                <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); border-radius: 8px; overflow: hidden;">
                    
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); padding: 40px 30px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: bold;">
                                ✅ Cảm Ơn Bạn Đã Liên Hệ
                            </h1>
                            <p style="margin: 10px 0 0 0; color: #dcfce7; font-size: 16px;">
                                ${companyName}
                            </p>
                        </td>
                    </tr>

                    <!-- Content -->
                    <tr>
                        <td style="padding: 40px 30px;">
                            <p style="margin: 0 0 20px 0; color: #374151; font-size: 18px; font-weight: 600;">
                                Xin chào ${data.name},
                            </p>
                            
                            <p style="margin: 0 0 20px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Cảm ơn bạn đã liên hệ với <strong>${companyName}</strong>!
                            </p>

                            <p style="margin: 0 0 30px 0; color: #4b5563; font-size: 16px; line-height: 1.6;">
                                Chúng tôi đã nhận được tin nhắn của bạn và sẽ phản hồi trong thời gian sớm nhất có thể. 
                                Đội ngũ chăm sóc khách hàng của chúng tôi sẽ liên hệ lại với bạn qua email hoặc số điện thoại bạn đã cung cấp.
                            </p>

                            <!-- Message Summary -->
                            <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
                                <h3 style="margin: 0 0 15px 0; color: #166534; font-size: 16px; font-weight: 600;">
                                    📝 Nội dung tin nhắn của bạn:
                                </h3>
                                <p style="margin: 0; color: #15803d; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">${data.message}</p>
                            </div>

                            <!-- Contact Info -->
                            <div style="background-color: #f9fafb; border-radius: 8px; padding: 25px; margin-bottom: 30px;">
                                <h3 style="margin: 0 0 20px 0; color: #1f2937; font-size: 18px; font-weight: 600; text-align: center;">
                                    Cần Hỗ Trợ Ngay?
                                </h3>
                                <table role="presentation" style="width: 100%; border-collapse: collapse;">
                                    <tr>
                                        <td style="padding: 10px 0; text-align: center;">
                                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                                📞 <strong style="color: #1f2937;">Hotline:</strong> 
                                                <a href="tel:${companyPhone}" style="color: #22c55e; text-decoration: none; font-weight: 600;">${companyPhone}</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; text-align: center;">
                                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                                📧 <strong style="color: #1f2937;">Email:</strong> 
                                                <a href="mailto:${companyEmail}" style="color: #22c55e; text-decoration: none; font-weight: 600;">${companyEmail}</a>
                                            </p>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding: 10px 0; text-align: center;">
                                            <p style="margin: 0; color: #6b7280; font-size: 14px;">
                                                📍 <strong style="color: #1f2937;">Địa chỉ:</strong> ${companyAddress}
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </div>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                                <tr>
                                    <td align="center">
                                        <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}" style="display: inline-block; background-color: #22c55e; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 2px 4px rgba(34, 197, 94, 0.3);">
                                            🌐 Ghé Thăm Website
                                        </a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 30px 0 0 0; color: #6b7280; font-size: 14px; line-height: 1.6; text-align: center;">
                                Trân trọng,<br>
                                <strong style="color: #1f2937;">${companyName}</strong>
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                            <p style="margin: 0 0 10px 0; color: #6b7280; font-size: 14px;">
                                Email này được gửi tự động, vui lòng không trả lời email này.
                            </p>
                            <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                                © ${new Date().getFullYear()} ${companyName}. All rights reserved.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;
    }
}

export default new ContactService();
