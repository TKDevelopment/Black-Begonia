const { config } = require('dotenv');
const { writeFileSync } = require('fs');

config();

const targetPath = './src/environments/environment.prod.ts';

const envConfigFile = `
    export const environment = {
        production: '${process.env['production']}',
        bypassAuth: '${process.env['bypassAuth']}',
        supabaseUrl: '${process.env['SUPABASE_URL']}',
        supabaseKey: '${process.env['SUPABASE_KEY']}',
        googleClientId: '${process.env['GOOGLE_CLIENT_ID']}',
        googleApiKey: '${process.env['GOOGLE_API_KEY']}',
    };
`;

writeFileSync(targetPath, envConfigFile);
console.log(`✅ Dev environment written to ${targetPath}`);
