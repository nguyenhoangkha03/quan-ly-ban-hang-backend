import { Request, Response } from 'express';
import generalSettingService from '@services/general-setting.service';
import { AppError } from '@utils/errors';
import { ErrorCode } from '@custom-types/common.type';

export class GeneralSettingController {
  async getGeneralSetting(_req: Request, res: Response) {
    try {
      const setting = await generalSettingService.getGeneralSetting();

      return res.status(200).json({
        success: true,
        data: setting,
        message: 'Lấy cài đặt chung thành công',
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Có lỗi xảy ra',
      });
    }
  }

  async updateGeneralSetting(req: Request, res: Response) {
    try {
      const userId = (req as any).user.id;
      const { brandName, logo, name, email, phone, address, taxCode, website, banks } = req.body;

      // Validate required fields
      if (!brandName || !name || !email || !phone || !address || !taxCode || !website) {
        throw new AppError(
          'Vui lòng điền đầy đủ các trường bắt buộc',
          400,
          ErrorCode.VALIDATION_ERROR
        );
      }

      const setting = await generalSettingService.updateGeneralSetting(
        {
          brandName,
          logo,
          name,
          email,
          phone,
          address,
          taxCode,
          website,
          banks,
        },
        userId
      );

      return res.status(200).json({
        success: true,
        data: setting,
        message: 'Cập nhật cài đặt chung thành công',
      });
    } catch (error: any) {
      return res.status(error.statusCode || 500).json({
        success: false,
        message: error.message || 'Có lỗi xảy ra',
      });
    }
  }
}

export default new GeneralSettingController();
