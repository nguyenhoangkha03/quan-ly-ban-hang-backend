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

  async sendPurchaseOrderEmail(purchaseOrder: any): Promise<boolean> {
    if (!purchaseOrder.supplier?.email) {
      logError('Không thể gửi email đơn đặt hàng - không tìm thấy email nhà cung cấp.', null, {
        poCode: purchaseOrder.poCode,
        supplierId: purchaseOrder.supplier?.id,
      });
      return false;
    }

    return await this.sendEmail({
      to: purchaseOrder.supplier.email,
      subject: `Đơn mua hàng ${purchaseOrder.poCode} - Công Ty Nam Việt`,
      html: this.getPurchaseOrderEmailTemplate(purchaseOrder),
      text: `Đơn mua hàng ${purchaseOrder.poCode}\n\nKính gửi ${purchaseOrder.supplier.supplierName},\n\nCông ty Nam Việt xin gửi đến Quý công ty đơn đặt hàng.\nVui lòng kiểm tra email HTML để xem chi tiết.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });
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

  // Send payment receipt email
  async sendPaymentReceiptEmail(receipt: any): Promise<boolean> {
    if (!receipt.customer?.email) {
      logError('Không thể gửi email phiếu thu - không tìm thấy email khách hàng.', null, {
        receiptCode: receipt.receiptCode,
        customerId: receipt.customerId,
      });
      return false;
    }

    return await this.sendEmail({
      to: receipt.customer.email,
      subject: `Biên lai thanh toán ${receipt.receiptCode} - Công Ty Nam Việt`,
      html: this.getPaymentReceiptEmailTemplate(receipt),
      text: `Biên lai thanh toán ${receipt.receiptCode}\n\nKính gửi ${receipt.customer.customerName},\n\nCông ty Nam Việt xin gửi đến quý khách biên lai thanh toán.\nVui lòng kiểm tra email HTML để xem chi tiết.\n\nTrân trọng,\nCông Ty Nam Việt`,
    });
  }

  private getPaymentReceiptEmailTemplate(receipt: any): string {
    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const receiptTypeLabels: Record<string, string> = {
      sales: 'Bán hàng',
      debt_collection: 'Thu công nợ',
      refund: 'Hoàn tiền',
      other: 'Khác',
    };

    const paymentMethodLabels: Record<string, string> = {
      cash: 'Tiền mặt',
      transfer: 'Chuyển khoản',
      card: 'Thẻ',
    };

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Biên Lai Thanh Toán - ${receipt.receiptCode}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">💳 BIÊN LAI THANH TOÁN</h1>
    <p style="color: #d1fae5; margin: 10px 0 0 0; font-size: 16px;">Số: ${receipt.receiptCode}</p>
  </div>

  <!-- Main Content -->
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <!-- Greeting -->
    <p style="font-size: 16px; margin-bottom: 20px;">
      Kính gửi: <strong>${receipt.customer?.customerName || '—'}</strong>
    </p>

    <p style="font-size: 14px; margin-bottom: 30px; line-height: 1.8;">
      Công ty Cổ Phần Hóa Sinh Nam Việt xin gửi đến quý khách biên lai thanh toán với các thông tin chi tiết như sau:
    </p>

    <!-- Company Info -->
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #10b981;">
      <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">Thông tin công ty</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; width: 150px; color: #64748b;">Công ty:</td>
          <td style="padding: 5px 0; font-weight: 600;">Công Ty Cổ Phần Hoá Sinh Nam Việt</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Địa chỉ:</td>
          <td style="padding: 5px 0;">QL30/ấp Đông Mỹ, Mỹ Hội, Cao Lãnh, Đồng Tháp</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Điện thoại:</td>
          <td style="padding: 5px 0;">0886 357 788</td>
        </tr>
      </table>
    </div>

    <!-- Receipt Info -->
    <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">Thông tin phiếu thu</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; width: 150px; color: #64748b;">Loại phiếu:</td>
          <td style="padding: 5px 0; font-weight: 600;">${receiptTypeLabels[receipt.receiptType] || receipt.receiptType}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Phương thức:</td>
          <td style="padding: 5px 0;">
            ${paymentMethodLabels[receipt.paymentMethod] || receipt.paymentMethod}${receipt.bankName ? ` - ${receipt.bankName}` : ''}
          </td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Ngày thu:</td>
          <td style="padding: 5px 0;">${formatDate(receipt.receiptDate)}</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Trạng thái:</td>
          <td style="padding: 5px 0;">
            <span style="background: ${receipt.isPosted ? '#dcfce7' : '#fef3c7'}; color: ${receipt.isPosted ? '#166534' : '#92400e'}; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
              ${receipt.isPosted ? 'Đã ghi sổ' : 'Chưa ghi sổ'}
            </span>
          </td>
        </tr>
      </table>
    </div>

    <!-- Amount Section -->
    <div style="background: #f8fafc; padding: 25px; border-radius: 8px; margin-bottom: 25px; border: 2px solid #10b981; text-align: center;">
      <p style="font-size: 14px; color: #64748b; margin: 0 0 10px 0;">TỔNG SỐ TIỀN THANH TOÁN</p>
      <p style="font-size: 32px; color: #10b981; margin: 0; font-weight: bold;">
        ${formatCurrency(receipt.amount)}
      </p>
    </div>

    ${receipt.transactionReference ? `
    <!-- Transaction Reference -->
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        <strong>Mã tham chiếu:</strong> ${receipt.transactionReference}
      </p>
    </div>
    ` : ''}

    ${receipt.notes ? `
    <!-- Notes -->
    <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
      <p style="font-size: 13px; color: #64748b; margin: 0;">
        <strong>Ghi chú:</strong> ${receipt.notes}
      </p>
    </div>
    ` : ''}

    <!-- Footer -->
    <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
    
    <p style="font-size: 13px; color: #666; margin-bottom: 10px;">
      Cảm ơn quý khách đã thanh toán. Vui lòng giữ biên lai này để làm bằng chứng thanh toán.
    </p>

    <p style="font-size: 12px; color: #999; text-align: center; margin-top: 20px;">
      Trân trọng,<br>
      <strong>Sales & Production System Team</strong><br>
      <em>Công Ty Cổ Phần Hoá Sinh Nam Việt</em>
    </p>
  </div>
</body>
</html>
    `;
  }

  private getPurchaseOrderEmailTemplate(purchaseOrder: any): string {
    const getStatusLabel = (status: string) => {
      const map: Record<string, string> = {
        pending: 'Chờ duyệt',
        approved: 'Đã duyệt',
        received: 'Đã nhận hàng',
        cancelled: 'Đã hủy',
      };
      return map[status] || status;
    };

    const formatCurrency = (amount: number) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
      }).format(amount);
    };

    const formatDate = (dateString: string) => {
      return new Date(dateString).toLocaleDateString('vi-VN');
    };

    const itemsRows =
      purchaseOrder.details
        ?.map((detail: any, index: any) => {
          const itemTotal = (detail.quantity || 0) * (detail.unitPrice || 0);
          return `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${detail.product?.productName || '—'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${
          detail.product?.unit || 'cái'
        }</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${
          detail.quantity || 0
        }</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${formatCurrency(
          detail.unitPrice || 0
        )}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right; font-weight: bold;">${formatCurrency(
          itemTotal
        )}</td>
      </tr>
    `;
        })
        .join('') || '';

    const totalQuantity =
      purchaseOrder.details?.reduce((sum: any, d: any) => sum + (d.quantity || 0), 0) || 0;
    const taxAmount = (purchaseOrder.subTotal || 0) * ((purchaseOrder.taxRate || 0) / 100);

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Đơn Mua Hàng - ${purchaseOrder.poCode}</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
  
  <!-- Header -->
  <div style="background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">📋 ĐƠN MUA HÀNG</h1>
    <p style="color: #e0e7ff; margin: 10px 0 0 0; font-size: 16px;">Số: ${purchaseOrder.poCode}</p>
  </div>

  <!-- Main Content -->
  <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
    
    <!-- Greeting -->
    <p style="font-size: 16px; margin-bottom: 20px;">
      Kính gửi: <strong>${purchaseOrder.supplier?.supplierName}</strong>
    </p>

    <p style="font-size: 14px; margin-bottom: 30px; line-height: 1.8;">
      Công ty Cổ Phần Hóa Sinh Nam Việt xin gửi đến Quý công ty đơn đặt hàng với các thông tin chi tiết như sau:
    </p>

    <!-- Company Info -->
    <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 25px; border-left: 4px solid #2563eb;">
      <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">Thông tin công ty</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; width: 150px; color: #64748b;">Công ty:</td>
          <td style="padding: 5px 0; font-weight: 600;">Công Ty Cổ Phần Hoá Sinh Nam Việt</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Địa chỉ:</td>
          <td style="padding: 5px 0;">QL30/ấp Đông Mỹ, Mỹ Hội, Cao Lãnh, Đồng Tháp</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Điện thoại:</td>
          <td style="padding: 5px 0;">0886 357 788</td>
        </tr>
      </table>
    </div>

    <!-- Order Info -->
    <div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
      <h3 style="margin: 0 0 15px 0; color: #1e293b; font-size: 16px;">Thông tin đơn hàng</h3>
      <table style="width: 100%; font-size: 14px;">
        <tr>
          <td style="padding: 5px 0; width: 150px; color: #64748b;">Kho nhận hàng:</td>
          <td style="padding: 5px 0; font-weight: 600;">${
            purchaseOrder.warehouse?.warehouseName || '—'
          }</td>
        </tr>
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Trạng thái:</td>
          <td style="padding: 5px 0;">
            <span style="background: #dbeafe; color: #1e40af; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600;">
              ${getStatusLabel(purchaseOrder.status)}
            </span>
          </td>
        </tr>
        ${
          purchaseOrder.orderDate
            ? `
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Ngày đặt hàng:</td>
          <td style="padding: 5px 0;">${formatDate(purchaseOrder.orderDate)}</td>
        </tr>
        `
            : ''
        }
        ${
          purchaseOrder.expectedDeliveryDate
            ? `
        <tr>
          <td style="padding: 5px 0; color: #64748b;">Ngày giao dự kiến:</td>
          <td style="padding: 5px 0; font-weight: 600; color: #dc2626;">${formatDate(
            purchaseOrder.expectedDeliveryDate
          )}</td>
        </tr>
        `
            : ''
        }
      </table>
    </div>

    <!-- Items Table -->
    <h3 style="margin: 30px 0 15px 0; color: #1e293b; font-size: 16px;">Chi tiết sản phẩm</h3>
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 20px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #475569;">STT</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: left; font-weight: 600; color: #475569;">Tên sản phẩm</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: center; font-weight: 600; color: #475569;">ĐVT</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: 600; color: #475569;">Số lượng</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: 600; color: #475569;">Đơn giá</th>
            <th style="border: 1px solid #ddd; padding: 12px; text-align: right; font-weight: 600; color: #475569;">Thành tiền</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
          
          <!-- Subtotal -->
          <tr style="background: #fafafa; font-weight: bold;">
            <td colspan="3" style="border: 1px solid #ddd; padding: 12px; text-align: right;">Tổng cộng:</td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${totalQuantity}</td>
            <td style="border: 1px solid #ddd; padding: 12px;"></td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #2563eb;">${formatCurrency(
              purchaseOrder.subTotal || 0
            )}</td>
          </tr>
          
          ${
            purchaseOrder.taxRate > 0
              ? `
          <!-- Tax -->
          <tr>
            <td colspan="5" style="border: 1px solid #ddd; padding: 12px; text-align: right;">
              Thuế VAT (${purchaseOrder.taxRate}%):
            </td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right;">${formatCurrency(
              taxAmount
            )}</td>
          </tr>
          
          <!-- Total with Tax -->
          <tr style="background: #eff6ff; font-weight: bold; font-size: 15px;">
            <td colspan="5" style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #1e40af;">
              TỔNG THANH TOÁN:
            </td>
            <td style="border: 1px solid #ddd; padding: 12px; text-align: right; color: #dc2626; font-size: 16px;">
              ${formatCurrency(purchaseOrder.totalAmount || 0)}
            </td>
          </tr>
          `
              : ''
          }
        </tbody>
      </table>
    </div>

    <!-- Notes -->
    ${
      purchaseOrder.notes
        ? `
    <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #92400e;">
        <strong>📝 Ghi chú:</strong> ${purchaseOrder.notes}
      </p>
    </div>
    `
        : ''
    }

    <!-- Important Notice -->
    <div style="background: #dcfce7; border-left: 4px solid #16a34a; padding: 15px; margin: 20px 0; border-radius: 5px;">
      <p style="margin: 0; font-size: 13px; color: #14532d;">
        ✅ <strong>Lưu ý:</strong> Vui lòng xác nhận đơn hàng và thời gian giao hàng sớm nhất có thể.
      </p>
    </div>

    <!-- Signature -->
    <div style="margin-top: 40px; text-align: right;">
      <p style="font-size: 14px; margin: 5px 0;">
        <strong>Người lập đơn</strong>
      </p>
      <p style="font-size: 13px; color: #64748b; margin: 5px 0;">
        ${purchaseOrder.creator?.fullName || '—'}
      </p>
    </div>

    <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">

    <!-- Footer -->
    <p style="font-size: 13px; color: #64748b; text-align: center; margin: 20px 0 0 0;">
      Trân trọng,<br>
      <strong style="color: #1e293b;">Công Ty Cổ Phần Hóa Sinh Nam Việt</strong><br>
      <span style="font-size: 12px;">QL30/ấp Đông Mỹ, Mỹ Hội, Cao Lãnh, ĐT | ĐT: 0886 357 788</span>
    </p>

    <!-- Auto-generated notice -->
    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="font-size: 11px; color: #94a3b8; margin: 0;">
        Email này được gửi tự động từ hệ thống quản lý. Vui lòng không trả lời trực tiếp email này.
      </p>
    </div>
  </div>
</body>
</html>
  `;
  }
}

export default new EmailService();
