export interface AppEnvironment {
    production: boolean | 'default';
    bypassAuth: boolean | 'default';
    supabaseUrl: string;
    supabaseAnonKey: string;
    grapesjsStudioLicenseKey: string;
    googleClientId: string;
    googleApiKey: string;
    ga4MeasurementId: string;
    paymentPublicOrigin: string;
    paypalClientId: string;
    paymentCapabilities: {
        stripeCard: boolean;
        venmo: boolean;
        cash: boolean;
        check: boolean;
    };
}
