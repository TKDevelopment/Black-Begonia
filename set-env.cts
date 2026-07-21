const { config } = require('dotenv');
const { writeFileSync } = require('fs');

config();

const targetPath = './src/environments/environment.prod.ts';
const supabaseUrl = process.env['SUPABASE_URL'] || 'https://example.supabase.co';
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'] || 'test-anon-key';
const grapesjsStudioLicenseKey = process.env['GRAPEJS_LICENSE_KEY'] || 'undefined';
const googleClientId = process.env['GOOGLE_CLIENT_ID'] || 'undefined';
const googleApiKey = process.env['GOOGLE_API_KEY'] || 'undefined';
const paymentPublicOrigin = process.env['PAYMENT_PUBLIC_ORIGIN'] || 'https://blackbegoniaflorals.com';
const paypalClientId = process.env['PAYPAL_CLIENT_ID'] || 'undefined';

const envConfigFile = `
    import type { AppEnvironment } from './environment.model';

    export const environment: AppEnvironment = {
        production: true,
        bypassAuth: false,
        supabaseUrl: '${supabaseUrl}',
        supabaseAnonKey: '${supabaseAnonKey}',
        grapesjsStudioLicenseKey: '${grapesjsStudioLicenseKey}',
        googleClientId: '${googleClientId}',
        googleApiKey: '${googleApiKey}',
        paymentPublicOrigin: '${paymentPublicOrigin}',
        paypalClientId: '${paypalClientId}',
        paymentCapabilities: {
            stripeCard: true,
            venmo: true,
            cash: true,
            check: true,
        },
    };
`;

writeFileSync(targetPath, envConfigFile);
console.log(`Production environment written to ${targetPath}`);
