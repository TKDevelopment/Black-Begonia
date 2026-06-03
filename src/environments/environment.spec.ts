import { environment } from './environment';

describe('default environment', () => {
  it('uses deterministic synthetic Supabase credentials for tests', () => {
    expect(environment.production).toBe('default');
    expect(environment.bypassAuth).toBe('default');
    expect(environment.supabaseUrl).toBe('https://example.supabase.co');
    expect(environment.supabaseAnonKey).toBe('test-anon-key');
  });

  it('defines optional browser integration keys with placeholder values', () => {
    expect(environment.grapesjsStudioLicenseKey).toBe('default');
    expect(environment.googleClientId).toBe('default');
    expect(environment.googleApiKey).toBe('default');
  });
});
