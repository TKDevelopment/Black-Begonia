import { AuthService } from '../auth/auth.service';

export type AuthServiceGuardTestDouble = jasmine.SpyObj<AuthService> & {
  isReady: boolean;
  isAuthenticated: boolean;
  isInternalUser: boolean;
};

export interface AuthServiceGuardState {
  isReady: boolean;
  isAuthenticated: boolean;
  isInternalUser: boolean;
}

export function createAuthServiceGuardTestDouble(
  state: Partial<AuthServiceGuardState> = {}
): AuthServiceGuardTestDouble {
  const authService = jasmine.createSpyObj<AuthService>('AuthService', ['init']) as AuthServiceGuardTestDouble;

  authService.isReady = state.isReady ?? true;
  authService.isAuthenticated = state.isAuthenticated ?? true;
  authService.isInternalUser = state.isInternalUser ?? true;
  authService.init.and.resolveTo();

  return authService;
}
