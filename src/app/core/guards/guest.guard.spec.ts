import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree } from '@angular/router';

import { AuthService } from '../auth/auth.service';
import { createAuthServiceGuardTestDouble, AuthServiceGuardTestDouble } from '../testing/auth-testing';
import { createRouterMock } from '../testing/router-testing';
import { guestGuard } from './guest.guard';

describe('guestGuard', () => {
  let authService: AuthServiceGuardTestDouble;
  let router: ReturnType<typeof createRouterMock>;
  let dashboardTree: UrlTree;

  function configureGuard(platformId: 'browser' | 'server' = 'browser'): void {
    dashboardTree = { toString: () => '/admin/dashboard' } as UrlTree;
    authService = createAuthServiceGuardTestDouble({
      isAuthenticated: false,
      isInternalUser: false,
    });
    router = createRouterMock();
    router.createUrlTree.and.returnValue(dashboardTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: platformId },
        { provide: AuthService, useValue: authService },
        { provide: Router, useValue: router },
      ],
    });
  }

  const executeGuard = () => TestBed.runInInjectionContext(
    () => guestGuard({} as never, {} as never) as Promise<boolean | UrlTree>
  );

  afterEach(() => TestBed.resetTestingModule());

  it('allows server-side rendering without auth initialization', async () => {
    configureGuard('server');

    await expectAsync(executeGuard()).toBeResolvedTo(true);
    expect(authService.init).not.toHaveBeenCalled();
  });

  it('initializes auth before browser guest decisions when needed', async () => {
    configureGuard();
    authService.isReady = false;

    await expectAsync(executeGuard()).toBeResolvedTo(true);

    expect(authService.init).toHaveBeenCalled();
  });

  it('allows unauthenticated guests to continue', async () => {
    configureGuard();

    await expectAsync(executeGuard()).toBeResolvedTo(true);
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('redirects authenticated internal users away from guest routes', async () => {
    configureGuard();
    authService.isAuthenticated = true;
    authService.isInternalUser = true;

    await expectAsync(executeGuard()).toBeResolvedTo(dashboardTree);

    expect(router.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
  });
});
