import { createAuthServiceGuardTestDouble } from './auth-testing';

describe('auth testing helpers', () => {
  it('creates ready authenticated internal-user guard doubles by default', async () => {
    const authService = createAuthServiceGuardTestDouble();

    expect(authService.isReady).toBeTrue();
    expect(authService.isAuthenticated).toBeTrue();
    expect(authService.isInternalUser).toBeTrue();
    await expectAsync(authService.init()).toBeResolved();
  });

  it('allows guard state overrides', () => {
    const authService = createAuthServiceGuardTestDouble({
      isReady: false,
      isAuthenticated: false,
      isInternalUser: false,
    });

    expect(authService.isReady).toBeFalse();
    expect(authService.isAuthenticated).toBeFalse();
    expect(authService.isInternalUser).toBeFalse();
  });
});
