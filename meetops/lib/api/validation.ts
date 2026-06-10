import { ApiError } from "@/lib/api/errors";

export function parseBigIntParam(value: string | undefined, label: string) {
  if (!value || !/^\d+$/.test(value)) {
    throw new ApiError("VALIDATION_ERROR", `${label} must be a numeric id.`);
  }
  return BigInt(value);
}

export function optionalString(
  value: unknown,
  label: string,
  maxLength: number,
  options: { allowNull?: boolean; required?: boolean } = {},
): string | null | undefined {
  if (value === undefined) {
    if (options.required) {
      throw new ApiError("VALIDATION_ERROR", `${label} is required.`);
    }
    return undefined;
  }
  if (value === null) {
    if (options.allowNull) return null;
    throw new ApiError("VALIDATION_ERROR", `${label} must be a string.`);
  }
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", `${label} must be a string.`);
  }
  const trimmed = value.trim();
  if (options.required && !trimmed) {
    throw new ApiError("VALIDATION_ERROR", `${label} is required.`);
  }
  if (trimmed.length > maxLength) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `${label} must be ${maxLength} characters or fewer.`,
    );
  }
  return trimmed || null;
}

export function optionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new ApiError("VALIDATION_ERROR", `${label} must be a boolean.`);
  }
  return value;
}

export function optionalInteger(
  value: unknown,
  label: string,
  { min, max }: { min: number; max: number },
): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ApiError("VALIDATION_ERROR", `${label} must be an integer.`);
  }
  if (value < min || value > max) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `${label} must be between ${min} and ${max}.`,
    );
  }
  return value;
}

export function optionalFutureDate(value: unknown, label: string): Date | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", `${label} must be an ISO timestamp.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ApiError("VALIDATION_ERROR", `${label} must be an ISO timestamp.`);
  }
  if (date <= new Date()) {
    throw new ApiError("VALIDATION_ERROR", `${label} must be in the future.`);
  }
  return date;
}

export function optionalDate(value: unknown, label: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new ApiError("VALIDATION_ERROR", `${label} must be an ISO timestamp.`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    throw new ApiError("VALIDATION_ERROR", `${label} must be an ISO timestamp.`);
  }
  return date;
}

export function requiredDate(value: unknown, label: string): Date {
  const date = optionalDate(value, label);
  if (!date) {
    throw new ApiError("VALIDATION_ERROR", `${label} is required.`);
  }
  return date;
}

export function optionalEnum<T extends string>(
  value: unknown,
  label: string,
  allowed: readonly T[],
): T | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `${label} must be one of: ${allowed.join(", ")}.`,
    );
  }
  return value as T;
}

export function paginationFromUrl(url: string, defaults = { limit: 50, offset: 0 }) {
  const searchParams = new URL(url).searchParams;
  const limit = Number(searchParams.get("limit") ?? defaults.limit);
  const offset = Number(searchParams.get("offset") ?? defaults.offset);

  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new ApiError("VALIDATION_ERROR", "limit must be between 1 and 100.");
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new ApiError("VALIDATION_ERROR", "offset must be zero or greater.");
  }

  return { limit, offset };
}
