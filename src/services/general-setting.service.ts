import { PrismaClient } from '@prisma/client';
import { AppError } from '@utils/errors';
import { ErrorCode } from '@custom-types/common.type';

const prisma = new PrismaClient();

export interface BankAccount {
  accountNumber: string;
  accountName: string;
  bankName: string;
  bankBranch: string;
}

export interface GeneralSettingUpdateDto {
  brandName: string;
  logo?: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  taxCode: string;
  website: string;
  banks?: BankAccount[];
}

export class GeneralSettingService {
  async getGeneralSetting() {
    try {
      let setting = await prisma.generalSetting.findFirst({
        include: {
          updater: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      // If no setting exists, create default one
      if (!setting) {
        setting = await prisma.generalSetting.create({
          data: {
            brandName: 'Công Ty Cổ Phần Hoá Sinh Nam Việt',
            name: 'hoasinhnamviet.com',
            email: 'hoasinhnamviet@gmail.com',
            phone: '0886357788',
            address: 'QL30/ấp Đông Mỹ, Mỹ Hội, Cao Lãnh, Đồng Tháp',
            taxCode: '1401226782',
            website: 'hoasinhnamviet.com',
            banks: JSON.stringify([]),
          },
          include: {
            updater: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });
      }

      const banksData = setting.banks ? JSON.parse(setting.banks) : [];

      return {
        id: setting.id,
        brandName: setting.brandName,
        logo: setting.logo,
        name: setting.name,
        email: setting.email,
        phone: setting.phone,
        address: setting.address,
        taxCode: setting.taxCode,
        website: setting.website,
        banks: banksData as BankAccount[],
        updatedBy: setting.updater,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      };
    } catch (error) {
      throw new AppError('Không thể lấy cài đặt chung', 500, ErrorCode.DATABASE_ERROR);
    }
  }

  async updateGeneralSetting(data: GeneralSettingUpdateDto, userId: number) {
    try {
      const { banks, ...generalData } = data;

      let setting = await prisma.generalSetting.findFirst({
        include: {
          updater: {
            select: {
              id: true,
              fullName: true,
              email: true,
            },
          },
        },
      });

      if (!setting) {
        // Create new setting if not exists
        setting = await prisma.generalSetting.create({
          data: {
            ...generalData,
            banks: JSON.stringify(banks || []),
            updatedBy: userId,
          },
          include: {
            updater: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });
      } else {
        // Update existing setting
        setting = await prisma.generalSetting.update({
          where: { id: setting.id },
          data: {
            ...generalData,
            banks: JSON.stringify(banks || []),
            updatedBy: userId,
          },
          include: {
            updater: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
          },
        });
      }

      const banksData = setting.banks ? JSON.parse(setting.banks) : [];

      return {
        id: setting.id,
        brandName: setting.brandName,
        logo: setting.logo,
        name: setting.name,
        email: setting.email,
        phone: setting.phone,
        address: setting.address,
        taxCode: setting.taxCode,
        website: setting.website,
        banks: banksData as BankAccount[],
        updatedBy: setting.updater,
        createdAt: setting.createdAt,
        updatedAt: setting.updatedAt,
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Không thể cập nhật cài đặt chung', 500, ErrorCode.DATABASE_ERROR);
    }
  }
}

export default new GeneralSettingService();
