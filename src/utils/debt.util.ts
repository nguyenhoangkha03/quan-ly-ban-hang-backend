// Định nghĩa interface cho đầu ra của hàm tính toán
export interface DebtMetrics {
  debtPercentage: number;
  availableCredit: number;
  isOverLimit: boolean;
  isNearLimit: boolean;
}

/**
 * Hàm tính toán các chỉ số nợ của khách hàng.
 * @param currentDebt - Số nợ hiện tại (kiểu number hoặc Decimal)
 * @param creditLimit - Hạn mức tín dụng (kiểu number hoặc Decimal)
 * @returns DebtMetrics object
 */
export const calculateDebtMetrics = (
  currentDebt: number | any, // Chấp nhận cả kiểu Decimal của Prisma
  creditLimit: number | any
): DebtMetrics => {
  // Chuyển đổi sang number để đảm bảo tính toán đúng
  const debt = Number(currentDebt) || 0;
  const limit = Number(creditLimit) || 0;

  // Tính phần trăm nợ
  const debtPercentage = limit > 0 ? (debt / limit) * 100 : 0;

  // Tính tín dụng khả dụng (không âm)
  const availableCredit = Math.max(0, limit - debt);

  // Kiểm tra vượt hạn mức
  const isOverLimit = debt > limit;

  // Kiểm tra sắp vượt hạn mức (ví dụ: từ 80% đến 100%)
  const isNearLimit = debt >= limit * 0.8 && debt <= limit;

  return {
    debtPercentage: Math.round(debtPercentage * 100) / 100, // Làm tròn 2 chữ số thập phân
    availableCredit,
    isOverLimit,
    isNearLimit,
  };
};