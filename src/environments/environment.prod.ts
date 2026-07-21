
    import type { AppEnvironment } from './environment.model';

    export const environment: AppEnvironment = {
        production: true,
        bypassAuth: false,
        supabaseUrl: 'https://example.supabase.co',
        supabaseAnonKey: 'test-anon-key',
        grapesjsStudioLicenseKey: 'undefined',
        googleClientId: 'undefined',
        googleApiKey: 'undefined',
        paymentPublicOrigin: 'https://blackbegoniaflorals.com',
        paypalClientId: 'undefined',
        paymentCapabilities: {
            stripeCard: true,
            venmo: true,
            cash: true,
            check: true,
        },
    };
