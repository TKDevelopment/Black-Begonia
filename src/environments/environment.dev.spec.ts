import { environment } from './environment.dev';

describe('development environment', () => {
  it('enables development auth bypass without marking the build as production', () => {
    expect(environment.production).toBeFalse();
    expect(environment.bypassAuth).toBeTrue();
  });

  it('provides the Supabase configuration shape consumed by SupabaseService', () => {
    expect(environment.supabaseUrl).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(environment.supabaseAnonKey).toMatch(/^sb_publishable_/);
    expect('supabaseKey' in environment).toBeFalse();
  });

  it('keeps browser integration keys on deterministic placeholders', () => {
    expect(environment.googleClientId).toBe('default');
    expect(environment.googleApiKey).toBe('default');
  });

  it('uses the local proposal portal URL for development builds', () => {
    expect(environment.proposalPortalUrl).toBe('http://localhost:4200/proposal/auth');
  });
});
