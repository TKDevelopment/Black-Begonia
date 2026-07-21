import type { AppEnvironment } from './environment.model';

export const environment: AppEnvironment = {
    production: 'default',
    bypassAuth: 'default',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    grapesjsStudioLicenseKey: 'default',
    googleClientId: 'default',
    googleApiKey: 'default',
    paymentPublicOrigin: 'http://localhost:4200',
    paypalClientId: 'default',
    paymentCapabilities: {
        stripeCard: true,
        venmo: true,
        cash: true,
        check: true,
    },
};
