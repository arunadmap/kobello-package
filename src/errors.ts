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
