import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Get password history count for user
export async function getPasswordHistoryCount(userId: number): Promise<number> {
  try {
    const result = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count
      FROM password_history
      WHERE user_id = ${userId}
    `;

    return Number(result[0]?.count || 0);
  } catch (error) {
    return 0;
  }
}

export default {
  getPasswordHistoryCount,
};
