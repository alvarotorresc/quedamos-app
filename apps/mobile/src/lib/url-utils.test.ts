import { describe, it, expect } from 'vitest';
import { sanitizeUrl } from './url-utils';

describe('sanitizeUrl', () => {
  it('allows https URLs', () => {
    expect(sanitizeUrl('https://meet.google.com/abc-xyz')).toBe('https://meet.google.com/abc-xyz');
  });

  it('allows http URLs', () => {
    expect(sanitizeUrl('http://zoom.us/j/123456')).toBe('http://zoom.us/j/123456');
  });

  it('rejects javascript: scheme', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBeUndefined();
  });

  it('rejects javascript: scheme with encoding', () => {
    expect(sanitizeUrl('javascript:alert(document.cookie)')).toBeUndefined();
  });

  it('rejects data: scheme', () => {
    expect(sanitizeUrl('data:text/html,<script>alert(1)</script>')).toBeUndefined();
  });

  it('rejects vbscript: scheme', () => {
    expect(sanitizeUrl('vbscript:MsgBox("XSS")')).toBeUndefined();
  });

  it('rejects ftp: scheme', () => {
    expect(sanitizeUrl('ftp://files.example.com')).toBeUndefined();
  });

  it('returns undefined for null', () => {
    expect(sanitizeUrl(null)).toBeUndefined();
  });

  it('returns undefined for undefined', () => {
    expect(sanitizeUrl(undefined)).toBeUndefined();
  });

  it('returns undefined for empty string', () => {
    expect(sanitizeUrl('')).toBeUndefined();
  });

  it('returns undefined for invalid URL', () => {
    expect(sanitizeUrl('not a url')).toBeUndefined();
  });
});
