const { config } = require('dotenv');
const { writeFileSync } = require('fs');

config();

const targetPath = './src/environments/environment.prod.ts';
const proposalPortalUrl =
    process.env['PROPOSAL_PORTAL_URL'] ||
    process.env['CLIENT_PORTAL_PROPOSAL_URL'] ||
    'https://blackbegoniaflorals.com/proposal/auth';
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://example.supabase.co';
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || 'test-anon-key';
const grapesjsStudioLicenseKey = process.env['GRAPEJS_LICENSE_KEY'] || 'default';
const googleClientId = process.env['GOOGLE_CLIENT_ID'] || 'default';
const googleApiKey = process.env['GOOGLE_API_KEY'] || 'default';

const envConfigFile = `
    import type { AppEnvironment } from './environment.model';

    export const environment: AppEnvironment = {
        production: true,
        bypassAuth: false,
        supabaseUrl: '${supabaseUrl}',
        supabaseAnonKey: '${supabaseAnonKey}',
        proposalPortalUrl: '${proposalPortalUrl}',
        grapesjsStudioLicenseKey: '${grapesjsStudioLicenseKey}',
        googleClientId: '${googleClientId}',
        googleApiKey: '${googleApiKey}',
    };
`;

writeFileSync(targetPath, envConfigFile);
console.log(`Production environment written to ${targetPath}`);
