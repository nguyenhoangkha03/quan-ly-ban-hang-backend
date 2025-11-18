import { PrismaClient } from '@prisma/client';
import { comparePassword, hashPassword } from './password';
import { ValidationError } from './errors';

/**
 * Password History Utilities
 *
 * Prevents password reuse by tracking password history
 * Requirement: User cannot reuse last 3 passwords
 */

const prisma = new PrismaClient();
const PASSWORD_HISTORY_LIMIT = 3;

/**
 * Check if password was used before
 *
 * @param userId - User ID
 * @param newPassword - New password to check
 * @returns true if password was used before
 */
export async function isPasswordReused(userId: number, newPassword: string): Promise<boolean> {
  // Get current password
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Check if new password matches current password
  const matchesCurrent = await comparePassword(newPassword, user.passwordHash);
  if (matchesCurrent) {
    return true;
  }

  // Get password history (last N passwords)
  const historyCount = await prisma.$executeRaw`
    SELECT COUNT(*) as count
    FROM password_history
    WHERE user_id = ${userId}
  `;

  // If we don't have password_history table yet, skip history check
  // This will be created in a migration
  if (!historyCount) {
    return false;
  }

  const history = await prisma.$queryRaw<Array<{ password_hash: string }>>`
    SELECT password_hash
    FROM password_history
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${PASSWORD_HISTORY_LIMIT}
  `;

  // Check if new password matches any in history
  for (const record of history) {
    const matches = await comparePassword(newPassword, record.password_hash);
    if (matches) {
      return true;
    }
  }

  return false;
}

/**
 * Add password to history
 *
 * @param userId - User ID
 * @param passwordHash - Hashed password to store
 */
export async function addPasswordToHistory(userId: number, passwordHash: string): Promise<void> {
  try {
    // Insert new password into history
    await prisma.$executeRaw`
      INSERT INTO password_history (user_id, password_hash, created_at)
      VALUES (${userId}, ${passwordHash}, NOW())
    `;

    // Keep only last N passwords
    await prisma.$executeRaw`
      DELETE FROM password_history
      WHERE user_id = ${userId}
      AND id NOT IN (
        SELECT id FROM (
          SELECT id FROM password_history
          WHERE user_id = ${userId}
          ORDER BY created_at DESC
          LIMIT ${PASSWORD_HISTORY_LIMIT}
        ) AS temp
      )
    `;
  } catch (error) {
    // If table doesn't exist, skip (will be created in migration)
    console.warn('Password history table not found, skipping history tracking');
  }
}

/**
 * Validate and change password with history check
 *
 * @param userId - User ID
 * @param currentPassword - Current password
 * @param newPassword - New password
 * @throws ValidationError if password was used before or current password is incorrect
 */
export async function changePasswordWithHistory(
  userId: number,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isCurrentValid = await comparePassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new ValidationError('Current password is incorrect');
  }

  // Check if new password was used before
  const wasReused = await isPasswordReused(userId, newPassword);
  if (wasReused) {
    throw new ValidationError(`Password cannot be the same as your last ${PASSWORD_HISTORY_LIMIT} passwords`);
  }

  // Hash new password
  const newPasswordHash = await hashPassword(newPassword);

  // Update user password
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  // Add old password to history
  await addPasswordToHistory(userId, user.passwordHash);
}

/**
 * Get password history count for user
 *
 * @param userId - User ID
 * @returns Number of passwords in history
 */
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

/**
 * Clear password history for user (admin function)
 *
 * @param userId - User ID
 */
export async function clearPasswordHistory(userId: number): Promise<void> {
  try {
    await prisma.$executeRaw`
      DELETE FROM password_history
      WHERE user_id = ${userId}
    `;
  } catch (error) {
    console.warn('Failed to clear password history:', error);
  }
}

export default {
  isPasswordReused,
  addPasswordToHistory,
  changePasswordWithHistory,
  getPasswordHistoryCount,
  clearPasswordHistory,
  PASSWORD_HISTORY_LIMIT,
};
