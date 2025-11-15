import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
  BadRequestError,
} from '@utils/errors';

describe('Custom Errors', () => {
  describe('AuthenticationError', () => {
    it('should create authentication error with correct properties', () => {
      const message = 'Invalid credentials';
      const error = new AuthenticationError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthenticationError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('AuthenticationError');
    });
  });

  describe('AuthorizationError', () => {
    it('should create authorization error with correct properties', () => {
      const message = 'Access denied';
      const error = new AuthorizationError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthorizationError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('AuthorizationError');
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with correct properties', () => {
      const message = 'Resource not found';
      const error = new NotFoundError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NotFoundError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });
  });

  describe('ValidationError', () => {
    it('should create validation error with correct properties', () => {
      const message = 'Invalid input';
      const error = new ValidationError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ValidationError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('ValidationError');
    });

    it('should accept details parameter', () => {
      const message = 'Validation failed';
      const details = [{ field: 'email', message: 'Invalid email format' }];
      const error = new ValidationError(message, details);

      expect(error.message).toBe(message);
      expect(error.details).toEqual(details);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error with correct properties', () => {
      const message = 'Resource already exists';
      const error = new ConflictError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ConflictError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('BadRequestError', () => {
    it('should create bad request error with correct properties', () => {
      const message = 'Bad request';
      const error = new BadRequestError(message);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe('BadRequestError');
    });
  });
});
