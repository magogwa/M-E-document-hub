export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(statusCode: number, message: string, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, AppError);
  }

  static badRequest(message: string, code = 'BAD_REQUEST') {
    return new AppError(400, message, code);
  }
  static unauthorized(message = 'Access denied. Your session may have expired.') {
    return new AppError(401, message, 'UNAUTHORIZED');
  }
  static forbidden(message = 'Access denied.') {
    return new AppError(403, message, 'FORBIDDEN');
  }
  static notFound(message = 'Not found.') {
    return new AppError(404, message, 'NOT_FOUND');
  }
  static conflict(message: string) {
    return new AppError(409, message, 'CONFLICT');
  }
  static tooLarge(message: string) {
    return new AppError(413, message, 'PAYLOAD_TOO_LARGE');
  }
}

export function assert(condition: unknown, error: AppError): asserts condition {
  if (!condition) throw error;
}

export const asyncHandler =
  (fn: (req: any, res: any, next: any) => Promise<unknown>) =>
  (req: any, res: any, next: any) => {
    fn(req, res, next).catch(next);
  };