import { Response } from 'express';
import { AuthRequest } from '@custom-types/common.type';
import paymentVoucherService from '@services/payment-voucher.service';

class PaymentVoucherController {
  // GET /api/payment-vouchers - Get all payment vouchers
  async getAll(req: AuthRequest, res: Response) {
    const result = await paymentVoucherService.getAll(req.query as any);

    res.status(200).json({
      success: true,
      data: result.data,
      meta: result.meta,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/payment-vouchers/:id - Get payment voucher by ID
  async getById(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const voucher = await paymentVoucherService.getById(id);

    res.status(200).json({
      success: true,
      data: voucher,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/payment-vouchers/supplier/:supplierId - Get vouchers by supplier
  async getBySupplier(req: AuthRequest, res: Response) {
    const supplierId = parseInt(req.params.supplierId);
    const vouchers = await paymentVoucherService.getBySupplier(supplierId);

    res.status(200).json({
      success: true,
      data: vouchers,
      meta: {
        total: vouchers.length,
      },
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/payment-vouchers/summary - Get summary statistics
  async getSummary(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;
    const summary = await paymentVoucherService.getSummary(fromDate as string, toDate as string);

    res.status(200).json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  }

  // GET /api/payment-vouchers/report/expense - Get expense report
  async getExpenseReport(req: AuthRequest, res: Response) {
    const { fromDate, toDate } = req.query;

    if (!fromDate || !toDate) {
      res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const report = await paymentVoucherService.getExpenseReport(
      fromDate as string,
      toDate as string
    );

    res.status(200).json({
      success: true,
      data: report,
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/payment-vouchers - Create new payment voucher
  async create(req: AuthRequest, res: Response) {
    const userId = req.user!.id;
    const voucher = await paymentVoucherService.create(req.body, userId);

    res.status(201).json({
      success: true,
      data: voucher,
      message: 'Payment voucher created successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/payment-vouchers/:id - Update payment voucher
  async update(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const voucher = await paymentVoucherService.update(id, req.body, userId);

    res.status(200).json({
      success: true,
      data: voucher,
      message: 'Payment voucher updated successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // PUT /api/payment-vouchers/:id/approve - Approve voucher
  async approve(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const voucher = await paymentVoucherService.approve(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: voucher,
      message: 'Payment voucher approved successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // POST /api/payment-vouchers/:id/post - Post voucher to accounting
  async post(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const voucher = await paymentVoucherService.post(id, userId, req.body);

    res.status(200).json({
      success: true,
      data: voucher,
      message: 'Payment voucher posted to accounting successfully',
      timestamp: new Date().toISOString(),
    });
  }

  // DELETE /api/payment-vouchers/:id - Delete payment voucher
  async delete(req: AuthRequest, res: Response) {
    const id = parseInt(req.params.id);
    const userId = req.user!.id;
    const result = await paymentVoucherService.delete(id, userId);

    res.status(200).json({
      success: true,
      message: result.message,
      timestamp: new Date().toISOString(),
    });
  }
}

export default new PaymentVoucherController();
