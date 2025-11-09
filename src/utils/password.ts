import bcrypt from 'bcrypt';
import { ValidationError } from './errors';

const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10');

// Hash password using bcrypt
export const hashPassword = async (password: string): Promise<string> => {
  try {
    const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Failed to hash password');
  }
};

// Compare plain password with hashed password
export const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Failed to compare password');
  }
};

// Validate password strength
// Requirements:
//  - Min 8 characters
//  - At least 1 uppercase letter
//  - At least 1 lowercase letter
//  - At least 1 number
//  - At least 1 special character
export const validatePasswordStrength = (password: string): boolean => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumber = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  if (password.length < minLength) {
    throw new ValidationError('Password must be at least 8 characters long');
  }

  if (!hasUpperCase) {
    throw new ValidationError('Password must contain at least 1 uppercase letter');
  }

  if (!hasLowerCase) {
    throw new ValidationError('Password must contain at least 1 lowercase letter');
  }

  if (!hasNumber) {
    throw new ValidationError('Password must contain at least 1 number');
  }

  if (!hasSpecialChar) {
    throw new ValidationError('Password must contain at least 1 special character');
  }

  return true;
};

// Generate random password
export const generateRandomPassword = (length: number = 12): string => {
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}';
  const all = uppercase + lowercase + numbers + special;

  let password = '';

  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('');
};
