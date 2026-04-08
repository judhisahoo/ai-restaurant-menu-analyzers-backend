import { BadRequestException } from '@nestjs/common';

type UnknownRecord = Record<string, unknown>;

export function assertObject(value: unknown, label: string): UnknownRecord {
  if (!value || Array.isArray(value) || typeof value !== 'object') {
    throw new BadRequestException(`${label} must be an object.`);
  }

  return value as UnknownRecord;
}

export function unwrapSinglePayload(
  payload: unknown,
  label: string,
): UnknownRecord {
  if (Array.isArray(payload)) {
    if (payload.length !== 1) {
      throw new BadRequestException(
        `${label} array must contain exactly one wrapper object.`,
      );
    }

    return assertObject(payload[0], `${label}[0]`);
  }

  return assertObject(payload, label);
}

export function getRequiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${label} must be a non-empty string.`);
  }

  return value.trim();
}

export function getOptionalString(
  value: unknown,
  label: string,
): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${label} must be a non-empty string when provided.`);
  }

  return value.trim();
}

export function getRequiredInteger(value: unknown, label: string): number {
  const parsedValue =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value)
        : Number.NaN;

  if (!Number.isInteger(parsedValue)) {
    throw new BadRequestException(`${label} must be an integer.`);
  }

  return parsedValue;
}

export function getRequiredIdentifier(value: unknown, label: string): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  return getRequiredString(value, label);
}

export function getArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new BadRequestException(`${label} must be a non-empty array.`);
  }

  return value;
}
