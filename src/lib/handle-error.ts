import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { isAppError } from "./errors";
import { ErrorCodes } from "./error-codes";

export function handleActionError(err: unknown): string {
  if (isAppError(err)) {
    if (!err.isOperational) {
      console.error(`[${err.code}]`, err.message, err.stack);
      return "حدث خطأ داخلي. يرجى المحاولة لاحقاً.";
    }
    return err.message;
  }

  if (err instanceof ZodError) {
    return err.issues[0]?.message ?? "بيانات غير صحيحة";
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    return mapPrismaError(err);
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    console.error(`[${ErrorCodes.VALIDATION_ERROR}]`, err.message);
    return "بيانات غير صحيحة في طلب قاعدة البيانات.";
  }

  if (err instanceof Prisma.PrismaClientInitializationError) {
    console.error(`[${ErrorCodes.SYSTEM_SERVICE_UNAVAILABLE}]`, err.message);
    return "تعذّر الاتصال بقاعدة البيانات.";
  }

  if (err instanceof Error) {
    console.error(
      `[${ErrorCodes.SYSTEM_INTERNAL_ERROR}]`,
      err.message,
      err.stack,
    );
    return "حدث خطأ غير متوقع. يرجى المحاولة لاحقاً.";
  }

  console.error(`[${ErrorCodes.SYSTEM_INTERNAL_ERROR}] Unknown throw:`, err);
  return "حدث خطأ غير معروف.";
}

function mapPrismaError(err: Prisma.PrismaClientKnownRequestError): string {
  switch (err.code) {
    case "P2002": {
      const target = (err.meta?.target as string[])?.join(", ") ?? "حقل";
      return `القيمة المدخلة في ${target} مستخدمة بالفعل.`;
    }
    case "P2003":
      return "السجل المرتبط غير موجود.";
    case "P2025":
      return "السجل المطلوب غير موجود.";
    case "P2022":
      console.error(
        `[${ErrorCodes.SYSTEM_INTERNAL_ERROR}] Column missing:`,
        err.meta,
      );
      return "خطأ في هيكل قاعدة البيانات. يرجى التواصل مع الدعم.";
    default:
      console.error(
        `[${ErrorCodes.SYSTEM_INTERNAL_ERROR}] Prisma ${err.code}:`,
        err.message,
      );
      return "خطأ في قاعدة البيانات. يرجى المحاولة لاحقاً.";
  }
}
