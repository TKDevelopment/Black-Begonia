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

  it('exposes only public payment capabilities and origins', () => {
    expect(environment.paymentPublicOrigin).toBe('http://localhost:4200');
    expect(environment.paymentCapabilities).toEqual({ stripeCard: true, venmo: true, cash: true, check: true });
    expect(environment.paypalClientId).toBe('default');
    for (const forbidden of ['stripeSecretKey', 'stripeWebhookSecret', 'paypalClientSecret', 'mailgunApiKey', 'mailgunSigningKey', 'paymentTokenEncryptionKey', 'supabaseServiceRoleKey', 'paymentAutomationKey']) {
      expect(forbidden in environment).toBeFalse();
    }
  });
});
