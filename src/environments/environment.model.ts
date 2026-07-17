export interface AppEnvironment {
    production: boolean | 'default';
    bypassAuth: boolean | 'default';
    supabaseUrl: string;
    supabaseAnonKey: string;
    grapesjsStudioLicenseKey: string;
    googleClientId: string;
    googleApiKey: string;
}
