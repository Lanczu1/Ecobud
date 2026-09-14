import { describe, expect, it } from 'vitest';
import { readAppVersionConfig } from './appVersion';

describe('readAppVersionConfig', () => {
  it('returns only the public version settings', () => {
    expect(readAppVersionConfig({
      APP_LATEST_VERSION: '1.2.0',
      APP_MINIMUM_VERSION: '1.1.0',
      APP_UPDATE_URL: 'https://example.com/update',
      JWT_SECRET: 'must-not-leak',
    })).toEqual({
      latestVersion: '1.2.0',
      minimumVersion: '1.1.0',
      updateUrl: 'https://example.com/update',
    });
  });

  it('rejects malformed versions', () => {
    expect(() => readAppVersionConfig({ APP_LATEST_VERSION: 'latest' })).toThrow();
  });

  it('accepts semantic pre-release versions', () => {
    expect(readAppVersionConfig({ APP_LATEST_VERSION: '1.2.0-rc.1' }).latestVersion).toBe('1.2.0-rc.1');
  });
});
