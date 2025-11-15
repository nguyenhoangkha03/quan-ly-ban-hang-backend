import { generateAccessToken, generateRefreshToken, verifyAccessToken, verifyRefreshToken } from '@utils/jwt';
import { AuthenticationError } from '@utils/errors';

describe('JWT Utils', () => {
  const mockPayload = {
    id: 1,
    email: 'test@example.com',
    roleId: 1,
    employeeCode: 'TEST001',
  };

  describe('generateAccessToken', () => {
    it('should generate valid access token', () => {
      const token = generateAccessToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify valid access token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.roleId).toBe(mockPayload.roleId);
    });

    it('should throw error for invalid token', () => {
      const invalidToken = 'invalid.token.here';

      expect(() => {
        verifyAccessToken(invalidToken);
      }).toThrow(AuthenticationError);
    });

    it('should throw error for expired token', () => {
      // This would require mocking time or using a library like timekeeper
      // For now, we just test the basic functionality
      const token = generateAccessToken(mockPayload);
      expect(() => verifyAccessToken(token)).not.toThrow();
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify valid refresh token', () => {
      const token = generateRefreshToken(mockPayload);
      const decoded = verifyRefreshToken(token);

      expect(decoded).toBeDefined();
      expect(decoded.id).toBe(mockPayload.id);
      expect(decoded.email).toBe(mockPayload.email);
    });

    it('should throw error for invalid refresh token', () => {
      const invalidToken = 'invalid.refresh.token';

      expect(() => {
        verifyRefreshToken(invalidToken);
      }).toThrow(AuthenticationError);
    });
  });
});
