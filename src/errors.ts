import type { ErrorCode } from './protocol';

/** Every SDK method rejects with this. Check `code` to decide what to do. */
export class KobelloError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.name = 'KobelloError';
    this.code = code;
  }
}

/**
 * True for a KobelloError. Unlike `instanceof`, this also works when a bundle ends up with two copies
 * of the SDK (each copy has its own KobelloError class), so it checks the name and code instead.
 */
export function isKobelloError(value: unknown): value is KobelloError {
  return value instanceof Error && value.name === 'KobelloError' && typeof (value as { code?: unknown }).code === 'string';
}
