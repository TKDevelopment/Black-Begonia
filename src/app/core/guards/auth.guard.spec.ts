import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { createAuthServiceGuardTestDouble, AuthServiceGuardTestDouble } from '../testing/auth-testing';
import { createRouterMock } from '../testing/router-testing';
import { authChildGuard, authGuard } from './auth.guard';

describe('authGuard', () => {
  let authService: AuthServiceGuardTestDouble;
  let router: ReturnType<typeof createRouterMock>;
  let loginTree: UrlTree;

  function configureGuard(platformId: 'browser' | 'server' = 'browser'): void {
    loginTree = { toString: () => '/login' } as UrlTree;
    authService = createAuthServiceGuardTestDouble();
    router = createRouterMock();
    router.createUrlTree.and.returnValue(loginTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  }

  const executeGuard = () => TestBed.runInInjectionContext(
    () => authGuard({} as never, {} as never) as Promise<boolean | UrlTree>
  );
  const executeChildGuard = () => TestBed.runInInjectionContext(
    () => authChildGuard({} as never, {} as never) as Promise<boolean | UrlTree>
  );

  afterEach(() => TestBed.resetTestingModule());

  it('allows server-side rendering without auth initialization', async () => {
    configureGuard('server');

    await expectAsync(executeGuard()).toBeResolvedTo(true);
    expect(authService.init).not.toHaveBeenCalled();
  });

  it('initializes auth before evaluating browser navigation when needed', async () => {
    configureGuard();
    authService.isReady = false;

    await expectAsync(executeGuard()).toBeResolvedTo(true);

    expect(authService.init).toHaveBeenCalled();
  });

  it('redirects unauthenticated browser users to login', async () => {
    configureGuard();
    authService.isAuthenticated = false;

    await expectAsync(executeGuard()).toBeResolvedTo(loginTree);

    expect(router.createUrlTree).toHaveBeenCalledWith(['/login']);
  });

  it('applies the same decision to child routes', async () => {
    configureGuard();

    await expectAsync(executeChildGuard()).toBeResolvedTo(true);
  });
});
