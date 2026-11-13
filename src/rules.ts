// The checks and limits the Kobello desktop host applies to app calls.
// Internal: the mock uses them so tests fail the same way the real app would.
// Keep in sync with the host (src/host/files.ts, storage.ts, notifications.ts and router.ts there).

import { KobelloError } from './errors';
import type { ErrorCode } from './protocol';

export const LIMITS = {
  pathLength: 1024,
  fileBytes: 50 * 1024 * 1024,          // 50 MB per file
  filesTotalBytes: 1024 * 1024 * 1024,  // 1 GB of files per app
  fileEntries: 10_000,                  // files and folders per app
  storageKeyLength: 256,
  storageValueBytes: 1024 * 1024,       // 1 MB per value
  storageTotalBytes: 10 * 1024 * 1024,  // 10 MB per app
  notificationTitle: 100,
  notificationBody: 500,
  notificationTag: 100,
  notificationsPerMinute: 10,
  urlLength: 4096,
};

// Names Windows reserves for devices, with or without an extension ("con", "nul.txt", "com1.log").
const RESERVED_NAMES = /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i;
const BAD_CHARACTERS = /[<>"|?*\0]/;

export function fail(code: ErrorCode, message: string): never {
  throw new KobelloError(code, message);
}

/** Checks that a value is a string of the allowed length and returns it. */
export function requireString(value: unknown, name: string, maxLength: number, allowEmpty = false): string {
  if (typeof value !== 'string') fail('INVALID_ARGUMENT', `${name} must be a string.`);
  if (!allowEmpty && value.length === 0) fail('INVALID_ARGUMENT', `${name} can't be empty.`);
  if (value.length > maxLength) fail('INVALID_ARGUMENT', `${name} is longer than ${maxLength} characters.`);
  return value;
}

/** Size of text in bytes, the way the host measures it (UTF-8). */
export const byteLength = (text: string): number => new TextEncoder().encode(text).byteLength;

/**
 * Checks an app's relative "/" path and returns it without empty parts. "" means the root folder.
 * Rejects anything that could leave the app folder or that Windows can't store as a file name.
 */
export function checkPath(path: unknown, allowRoot = false): string {
  const value = requireString(path, 'Path', LIMITS.pathLength, allowRoot);
  const parts = value.split('/').filter(Boolean);
  const unsafe = value.startsWith('/') || value.includes('\\') || value.includes(':') ||
    parts.some((part) => part === '.' || part === '..' || RESERVED_NAMES.test(part) || BAD_CHARACTERS.test(part) ||
      // Windows drops a trailing dot or space, so "a." and "a" would be the same file.
      part.endsWith('.') || part.endsWith(' '));
  if (unsafe) fail('INVALID_ARGUMENT', `Path must be relative and stay inside the app folder: "${value}"`);
  if (!allowRoot && parts.length === 0) fail('INVALID_ARGUMENT', 'Path is empty.');
  return parts.join('/');
}

/** Only these links may be opened in the user's browser or mail app. */
export function checkLink(url: unknown): string {
  const value = requireString(url, 'URL', LIMITS.urlLength);
  if (!/^(https?:|mailto:)/i.test(value)) fail('INVALID_ARGUMENT', 'Only http, https and mailto links can be opened.');
  return value;
}
