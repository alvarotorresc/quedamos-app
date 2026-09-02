import { describe, it, expect } from 'vitest';
import { resolveDeepLinkPath } from './deep-link';

describe('resolveDeepLinkPath', () => {
  it('accepts the production host', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com/join/12345678')).toBe(
      '/join/12345678',
    );
  });

  it('accepts the legacy vercel host', () => {
    expect(resolveDeepLinkPath('https://quedamos-app-mobile.vercel.app/join/12345678')).toBe(
      '/join/12345678',
    );
  });

  it('keeps the query string', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com/tabs/plans?eventId=abc')).toBe(
      '/tabs/plans?eventId=abc',
    );
  });

  it('keeps the hash, where Supabase puts the recovery tokens', () => {
    expect(
      resolveDeepLinkPath('https://quedamos.alvarotc.com/reset-password#access_token=xyz'),
    ).toBe('/reset-password#access_token=xyz');
  });

  it('is case-insensitive on the host', () => {
    expect(resolveDeepLinkPath('https://QUEDAMOS.alvarotc.com/reset-password')).toBe(
      '/reset-password',
    );
  });

  it('ignores an explicit port on an allowed host', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com:443/join/12345678')).toBe(
      '/join/12345678',
    );
  });

  it('rejects a foreign host even with an allowed path', () => {
    expect(resolveDeepLinkPath('https://evil.com/join/12345678')).toBeNull();
  });

  it('rejects a host that only ends with the allowed one', () => {
    expect(resolveDeepLinkPath('https://evil-quedamos.alvarotc.com.attacker.io/tabs/plans')).toBe(
      null,
    );
  });

  it('rejects a subdomain of an allowed host', () => {
    expect(resolveDeepLinkPath('https://attacker.quedamos.alvarotc.com/tabs/plans')).toBeNull();
  });

  it('rejects http on an allowed host', () => {
    expect(resolveDeepLinkPath('http://quedamos.alvarotc.com/join/12345678')).toBeNull();
  });

  it('rejects a custom scheme on an allowed host', () => {
    expect(resolveDeepLinkPath('app.quedamos://quedamos.alvarotc.com/join/12345678')).toBeNull();
  });

  it('rejects the javascript scheme', () => {
    expect(resolveDeepLinkPath('javascript:alert(1)')).toBeNull();
  });

  it('rejects an allowed host with a path outside the allowlist', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com/admin')).toBeNull();
  });

  it('rejects a path that merely starts like an allowed prefix', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com/tabsy')).toBeNull();
  });

  it('accepts the bare /tabs path', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com/tabs')).toBe('/tabs');
  });

  it('rejects an attacker host smuggled in the userinfo', () => {
    expect(resolveDeepLinkPath('https://quedamos.alvarotc.com@evil.com/join/12345678')).toBeNull();
  });

  it('rejects a malformed URL', () => {
    expect(resolveDeepLinkPath('not a url')).toBeNull();
  });

  it('rejects an empty string', () => {
    expect(resolveDeepLinkPath('')).toBeNull();
  });
});
