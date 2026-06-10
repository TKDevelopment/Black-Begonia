export interface AppEnvironment {
    production: boolean | 'default';
    bypassAuth: boolean | 'default';
    supabaseUrl: string;
    supabaseAnonKey: string;
    // Browser-facing fallback used by the CRM workflow when composing proposal-access links.
    // Backend delivery still relies on CLIENT_PORTAL_PROPOSAL_URL inside Supabase edge functions.
    proposalPortalUrl: string;
    grapesjsStudioLicenseKey: string;
    googleClientId: string;
    googleApiKey: string;
}

export const environment: AppEnvironment = {
    production: 'default',
    bypassAuth: 'default',
    supabaseUrl: 'https://example.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    proposalPortalUrl: 'https://blackbegoniaflorals.com/proposal/auth',
    grapesjsStudioLicenseKey: 'default',
    googleClientId: 'default',
    googleApiKey: 'default'
};
