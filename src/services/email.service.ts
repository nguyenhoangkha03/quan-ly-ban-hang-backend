import nodemailer, { Transporter } from 'nodemailer';
import { logError, logInfo } from '@utils/logger';
import { EmailOptions } from '@custom-types/common.type';

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initialize();
  }

  // Initialize email transporter
  private initialize() {
    try {
      const smtpConfig = {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      };

      if (!smtpConfig.host || !smtpConfig.auth.user || !smtpConfig.auth.pass) {
        logInfo('Email service not configured. Email sending will be disabled.');
        this.isConfigured = false;
        return;
      }

      this.transporter = nodemailer.createTransport(smtpConfig);
      this.isConfigured = true;

      this.transporter.verify((error) => {
        if (error) {
          logError('Email service verification failed:', error);
          this.isConfigured = false;
        } else {
          logInfo('✅ Email service is ready');
        }
      });
    } catch (error) {
      logError('Failed to initialize email service:', error);
      this.isConfigured = false;
    }
  }

  // Send email
  async sendEmail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      logInfo('Email not sent - service not configured', {
        to: options.to,
        subject: options.subject,
      });
      return false;
    }

    try {
      const mailOptions = {
        from: `"${process.env.SMTP_FROM_NAME || 'Sales & Production System'}" <${
          process.env.SMTP_FROM || process.env.SMTP_USER
        }>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      };

      const info = await this.transporter.sendMail(mailOptions);
      logInfo('Email sent successfully', { to: options.to, messageId: info.messageId });
      return true;
    } catch (error) {
      logError('Failed to send email', error, { to: options.to, subject: options.subject });
      return false;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(to: string, fullName: string, resetToken: string): Promise<boolean> {
    const resetLink = `${
      process.env.FRONTEND_URL || 'http://localhost:3001'
    }/reset-password?token=${resetToken}`;

    const html = this.getPasswordResetEmailTemplate(fullName, resetLink);
    const text = `
Hello ${fullName},

We received a request to reset your password for your Sales & Production System account.

Click the link below to reset your password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this, please ignore this email.

Best regards,
Sales & Production System Team
    `;

    return await this.sendEmail({
      to,
      subject: 'Password Reset Request',
      html,
      text,
    });
  }

  // Send welcome email
  async sendWelcomeEmail(
    to: string,
    fullName: string,
    employeeCode: string,
    temporaryPassword: string
  ): Promise<boolean> {
    const loginLink = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/login`;

    const html = this.getWelcomeEmailTemplate(fullName, employeeCode, temporaryPassword, loginLink);
    const text = `
Hello ${fullName},

Welcome to Sales & Production System!

Your account has been created successfully.

Login Credentials:
- Employee Code: ${employeeCode}
- Email: ${to}
- Temporary Password: ${temporaryPassword}

Login here: ${loginLink}

IMPORTANT: Please change your password after first login.

Best regards,
Sales & Production System Team
    `;

    return await this.sendEmail({
      to,
      subject: 'Welcome to Sales & Production System',
      html,
      text,
    });
  }

  // Send password changed notification
  async sendPasswordChangedEmail(to: string, fullName: string): Promise<boolean> {
    const html = this.getPasswordChangedEmailTemplate(fullName);
    const text = `
Hello ${fullName},

Your password has been changed successfully.

If you didn't make this change, please contact your administrator immediately.

Best regards,
Sales & Production System Team
    `;

    return await this.sendEmail({
      to,
      subject: 'Password Changed Successfully',
      html,
      text,
    });
  }

  // Password reset email template
  private getPasswordResetEmailTemplate(fullName: string, resetLink: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔐 Password Reset</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${fullName}</strong>,</p>
    
    <p style="font-size: 14px; margin-bottom: 20px;">
      We received a request to reset your password for your <strong>Sales & Production System</strong> account.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetLink}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 15px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold; 
                display: inline-block;">
        Reset Password
      </a>
    </div>
    
    <p style="font-size: 13px; color: #666; margin-bottom: 20px;">
      Or copy and paste this link into your browser:
    </p>
    <p style="font-size: 12px; color: #667eea; word-break: break-all; background: white; padding: 10px; border-radius: 5px;">
      ${resetLink}
    </p>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⚠️ <strong>Important:</strong> This link will expire in <strong>1 hour</strong>.
      </p>
    </div>
    
    <p style="font-size: 13px; color: #666;">
      If you didn't request this password reset, please ignore this email. Your password will remain unchanged.
    </p>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Best regards,<br>
      <strong>Sales & Production System Team</strong>
    </p>
  </div>
</body>
</html>
    `;
  }

  // Welcome email template
  private getWelcomeEmailTemplate(
    fullName: string,
    employeeCode: string,
    temporaryPassword: string,
    loginLink: string
  ): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🎉 Welcome!</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${fullName}</strong>,</p>
    
    <p style="font-size: 14px; margin-bottom: 20px;">
      Welcome to <strong>Sales & Production System</strong>! Your account has been created successfully.
    </p>
    
    <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <h3 style="margin-top: 0; color: #667eea;">🔑 Login Credentials</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 8px 0;"><strong>Employee Code:</strong></td>
          <td style="padding: 8px 0;">${employeeCode}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0;"><strong>Temporary Password:</strong></td>
          <td style="padding: 8px 0; font-family: monospace; background: #f5f5f5; padding: 5px 10px; border-radius: 3px;">
            ${temporaryPassword}
          </td>
        </tr>
      </table>
    </div>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" 
         style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                padding: 15px 40px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold; 
                display: inline-block;">
        Login Now
      </a>
    </div>
    
    <div style="background: #d1ecf1; border-left: 4px solid #0c5460; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #0c5460;">
        🔒 <strong>Security Note:</strong> Please change your password after first login.
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Best regards,<br>
      <strong>Sales & Production System Team</strong>
    </p>
  </div>
</body>
</html>
    `;
  }

  // Password changed email template
  private getPasswordChangedEmailTemplate(fullName: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Password Changed</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Hello <strong>${fullName}</strong>,</p>
    
    <p style="font-size: 14px; margin-bottom: 20px;">
      Your password for <strong>Sales & Production System</strong> has been changed successfully.
    </p>
    
    <div style="background: #d4edda; border-left: 4px solid #28a745; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #155724;">
        ✓ Your password has been updated and is now active.
      </p>
    </div>
    
    <div style="background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #856404;">
        ⚠️ If you didn't make this change, please contact your administrator immediately.
      </p>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Best regards,<br>
      <strong>Sales & Production System Team</strong>
    </p>
  </div>
</body>
</html>
    `;
  }

  // Send notification email
  async sendNotificationEmail(
    to: string,
    data: { name: string; title: string; message: string }
  ): Promise<boolean> {
    const html = this.getNotificationEmailTemplate(data.name, data.title, data.message);
    const text = `
Hello ${data.name},

${data.title}

${data.message}

Best regards,
Sales & Production System Team
    `;

    return await this.sendEmail({
      to,
      subject: data.title,
      html,
      text,
    });
  }

  // Notification email template
  private getNotificationEmailTemplate(name: string, title: string, message: string): string {
    // Determine icon and color based on title keywords
    let icon = '🔔';
    let headerColor = '#667eea';
    let borderColor = '#667eea';

    if (title.toLowerCase().includes('cảnh báo') || title.toLowerCase().includes('warning')) {
      icon = '⚠️';
      headerColor = '#ffc107';
      borderColor = '#ffc107';
    } else if (title.toLowerCase().includes('lỗi') || title.toLowerCase().includes('error')) {
      icon = '❌';
      headerColor = '#dc3545';
      borderColor = '#dc3545';
    } else if (
      title.toLowerCase().includes('thành công') ||
      title.toLowerCase().includes('success')
    ) {
      icon = '✅';
      headerColor = '#28a745';
      borderColor = '#28a745';
    } else if (title.toLowerCase().includes('đơn hàng') || title.toLowerCase().includes('order')) {
      icon = '📦';
      headerColor = '#17a2b8';
      borderColor = '#17a2b8';
    } else if (title.toLowerCase().includes('công nợ') || title.toLowerCase().includes('debt')) {
      icon = '💰';
      headerColor = '#fd7e14';
      borderColor = '#fd7e14';
    }

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: ${headerColor}; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">${icon} ${title}</h1>
  </div>
  
  <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
    <p style="font-size: 16px; margin-bottom: 20px;">Xin chào <strong>${name}</strong>,</p>
    
    <div style="background: white; border-left: 4px solid ${borderColor}; padding: 20px; border-radius: 5px; margin: 20px 0;">
      <p style="font-size: 14px; margin: 0; white-space: pre-line;">
        ${message}
      </p>
    </div>
    
    <p style="font-size: 13px; color: #666; margin-top: 20px;">
      Vui lòng đăng nhập vào hệ thống để xem chi tiết.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:3001'}/notifications" 
         style="background: ${headerColor}; 
                color: white; 
                padding: 12px 30px; 
                text-decoration: none; 
                border-radius: 5px; 
                font-weight: bold; 
                display: inline-block;">
        Xem Thông Báo
      </a>
    </div>
    
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 12px; color: #999; text-align: center;">
      Trân trọng,<br>
      <strong>Sales & Production System Team</strong>
    </p>
  </div>
</body>
</html>
    `;
  }

  // Check if email service is configured
  isEmailServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export default new EmailService();
