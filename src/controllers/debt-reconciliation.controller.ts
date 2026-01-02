// import { Response } from 'express';
// import { AuthRequest } from '@custom-types/common.type';
// import debtReconciliationService from '@services/debt-reconciliation.service';

// class DebtReconciliationController {
//   // GET /api/debt-reconciliation - Get all reconciliations
//   async getAll(req: AuthRequest, res: Response) {
//     const result = await debtReconciliationService.getAll(req.query as any);
//     console.log('🔥 [BE-DEBUG] Data trả về cho FE:', result);


//     res.status(200).json({
//       success: true,
//       data: result.data,
//       meta: result.meta,
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // GET /api/debt-reconciliation/:id - Get reconciliation by ID
//   async getById(req: AuthRequest, res: Response) {
//     const id = parseInt(req.params.id);
//     const reconciliation = await debtReconciliationService.getById(id);
//     console.log('🔥 [BE-DEBUG] Data trả về cho FE:', reconciliation);

//     res.status(200).json({
//       success: true,
//       data: reconciliation,
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // GET /api/debt-reconciliation/customer/:customerId - Get by customer
//   async getByCustomer(req: AuthRequest, res: Response) {
//     const customerId = parseInt(req.params.customerId);
//     const reconciliations = await debtReconciliationService.getByCustomer(customerId);

//     res.status(200).json({
//       success: true,
//       data: reconciliations,
//       meta: {
//         total: reconciliations.length,
//       },
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // GET /api/debt-reconciliation/supplier/:supplierId - Get by supplier
//   async getBySupplier(req: AuthRequest, res: Response) {
//     const supplierId = parseInt(req.params.supplierId);
//     const reconciliations = await debtReconciliationService.getBySupplier(supplierId);

//     res.status(200).json({
//       success: true,
//       data: reconciliations,
//       meta: {
//         total: reconciliations.length,
//       },
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // GET /api/debt-reconciliation/summary - Get summary statistics
//   async getSummary(req: AuthRequest, res: Response) {
//     const { fromDate, toDate } = req.query;
//     const summary = await debtReconciliationService.getSummary(
//       fromDate as string,
//       toDate as string
//     );

//     res.status(200).json({
//       success: true,
//       data: summary,
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // POST /api/debt-reconciliation/monthly - Create monthly reconciliation
//   async createMonthly(req: AuthRequest, res: Response) {
//     const userId = req.user!.id;
//     const reconciliation = await debtReconciliationService.create(
//       { ...req.body, reconciliationType: 'monthly' },
//       userId
//     );

//     res.status(201).json({
//       success: true,
//       data: reconciliation,
//       message: 'Monthly reconciliation created successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // POST /api/debt-reconciliation/quarterly - Create quarterly reconciliation
//   async createQuarterly(req: AuthRequest, res: Response) {
//     const userId = req.user!.id;
//     const reconciliation = await debtReconciliationService.create(
//       { ...req.body, reconciliationType: 'quarterly' },
//       userId
//     );

//     res.status(201).json({
//       success: true,
//       data: reconciliation,
//       message: 'Quarterly reconciliation created successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // POST /api/debt-reconciliation/yearly - Create yearly reconciliation
//   async createYearly(req: AuthRequest, res: Response) {
//     const userId = req.user!.id;
//     const reconciliation = await debtReconciliationService.create(
//       { ...req.body, reconciliationType: 'yearly' },
//       userId
//     );

//     res.status(201).json({
//       success: true,
//       data: reconciliation,
//       message: 'Yearly reconciliation created successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // PUT /api/debt-reconciliation/:id/confirm - Confirm reconciliation
//   async confirm(req: AuthRequest, res: Response) {
//     const id = parseInt(req.params.id);
//     const userId = req.user!.id;
//     const reconciliation = await debtReconciliationService.confirm(id, req.body, userId);

//     res.status(200).json({
//       success: true,
//       data: reconciliation,
//       message: 'Reconciliation confirmed successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // PUT /api/debt-reconciliation/:id/dispute - Dispute reconciliation
//   async dispute(req: AuthRequest, res: Response) {
//     const id = parseInt(req.params.id);
//     const userId = req.user!.id;
//     const { reason } = req.body;

//     if (!reason) {
//       res.status(400).json({
//         success: false,
//         message: 'Dispute reason is required',
//         timestamp: new Date().toISOString(),
//       });
//       return;
//     }

//     const reconciliation = await debtReconciliationService.dispute(id, reason, userId);

//     res.status(200).json({
//       success: true,
//       data: reconciliation,
//       message: 'Reconciliation disputed successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // POST /api/debt-reconciliation/:id/send-email - Send reconciliation email
//   async sendEmail(req: AuthRequest, res: Response) {
//     const id = parseInt(req.params.id);
//     const userId = req.user!.id;
//     const result = await debtReconciliationService.sendEmail(id, req.body, userId);

//     res.status(200).json({
//       success: true,
//       data: result,
//       message: 'Reconciliation email sent successfully',
//       timestamp: new Date().toISOString(),
//     });
//   }

//   // GET /api/debt-reconciliation/:id/pdf - Export to PDF (placeholder)
//   async exportPdf(req: AuthRequest, res: Response) {
//     const id = parseInt(req.params.id);
//     const reconciliation = await debtReconciliationService.getById(id);

//     // TODO: Implement PDF generation
//     // For now, return reconciliation data

//     res.status(200).json({
//       success: true,
//       data: reconciliation,
//       message: 'Đã gửi thông tin để xuất PDF',
//       timestamp: new Date().toISOString(),
//     });
//   }
// }

// export default new DebtReconciliationController();
