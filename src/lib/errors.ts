import { ErrorCodes } from "./error-codes";

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode = 500,
    code: string = ErrorCodes.SYSTEM_INTERNAL_ERROR,
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthError extends AppError {
  constructor(message = "غير مصرح") {
    super(message, 401, ErrorCodes.AUTH_UNAUTHORIZED);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "ليس لديك صلاحية للقيام بهذا الإجراء") {
    super(message, 403, ErrorCodes.AUTH_FORBIDDEN);
  }
}

export class NotFoundError extends AppError {
  constructor(resource = "السجل") {
    super(`${resource} غير موجود`, 404, ErrorCodes.LISTING_NOT_FOUND);
  }
}

export class ValidationError extends AppError {
  public readonly fields?: Record<string, string>;
  constructor(message = "بيانات غير صحيحة", fields?: Record<string, string>) {
    super(message, 422, ErrorCodes.VALIDATION_ERROR);
    this.fields = fields;
  }
}

export class RateLimitError extends AppError {
  constructor(message = "لقد تجاوزت الحد المسموح به. يرجى المحاولة لاحقاً.") {
    super(message, 429, ErrorCodes.AUTH_RATE_LIMITED);
  }
}

export class LimitExceededError extends AppError {
  constructor(message: string, code = ErrorCodes.LISTING_LIMIT_REACHED) {
    super(message, 422, code);
  }
}

export class InvalidFileError extends AppError {
  constructor(message = "نوع الملف غير مدعوم أو الملف تالف") {
    super(message, 422, ErrorCodes.MEDIA_INVALID_TYPE);
  }
}

export class FileTooLargeError extends AppError {
  constructor(maxMb: number) {
    super(
      `حجم الملف يتجاوز الحد المسموح (${maxMb}MB)`,
      413,
      ErrorCodes.MEDIA_SIZE_EXCEEDED,
    );
  }
}

export class MediaCountExceededError extends AppError {
  constructor(message: string) {
    super(message, 422, ErrorCodes.MEDIA_COUNT_EXCEEDED);
  }
}

export class MediaDurationExceededError extends AppError {
  constructor(message: string) {
    super(message, 422, ErrorCodes.MEDIA_DURATION_EXCEEDED);
  }
}

export class CloudinaryError extends AppError {
  constructor(message = "فشل رفع الملف إلى Cloudinary") {
    super(message, 502, ErrorCodes.SYSTEM_SERVICE_UNAVAILABLE, false);
  }
}

export class DatabaseError extends AppError {
  constructor(message = "خطأ في قاعدة البيانات") {
    super(message, 500, ErrorCodes.SYSTEM_INTERNAL_ERROR, false);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

export function isOperationalError(err: unknown): boolean {
  return isAppError(err) && err.isOperational;
}
