import { describe, it, expect } from 'vitest';
import config from './capacitor.config';

describe('capacitor.config', () => {
  it('serves the native WebView from the public host so hCaptcha does not run in localhost mode', () => {
    // hCaptcha refuses to fully verify on a `localhost` origin (it logs "localhost detected"
    // and degrades), which is what the default Capacitor origin looks like. Serving the
    // WebView under the real domain keeps the origin inside the sitekey's host list.
    expect(config.server?.androidScheme).toBe('https');
    expect(config.server?.hostname).toBe('quedamos.alvarotc.com');
  });
});
