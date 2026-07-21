import { environment } from './environment.prod';

describe('production environment', () => {
  it('disables auth bypass and marks production builds explicitly', () => {
    expect(environment.production).toBeTrue();
    expect(environment.bypassAuth).toBeFalse();
  });

  it('exposes the Supabase configuration keys required at build time', () => {
    expect(environment.supabaseUrl).toBeDefined();
    expect(environment.supabaseAnonKey).toBeDefined();
    expect('supabaseKey' in environment).toBeFalse();
  });

  it('keeps deploy-time placeholders for externally supplied keys', () => {
    expect(environment.grapesjsStudioLicenseKey).toBe('undefined');
    expect(environment.googleClientId).toBe('undefined');
    expect(environment.googleApiKey).toBe('undefined');
    expect(environment.paypalClientId).toBe('undefined');
    expect(environment.paymentPublicOrigin).toBe('https://blackbegoniaflorals.com');
  });

  it('cannot carry privileged payment, email, encryption, or automation secrets', () => {
    ['stripeSecretKey', 'stripeWebhookSecret', 'paypalClientSecret', 'paypalWebhookId', 'mailgunApiKey', 'mailgunSigningKey', 'paymentTokenEncryptionKey', 'supabaseServiceRoleKey', 'paymentAutomationKey']
      .forEach((key) => expect(key in environment).toBeFalse());
  });
});
