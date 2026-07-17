import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { Session, User } from '@supabase/supabase-js';

import { SupabaseService } from '../supabase/clients/supabase.service';
import { AuthService } from './auth.service';
import { Profile } from './auth.models';

describe('AuthService', () => {
  const user = { id: 'user-1', email: 'staff@example.com' } as User;
  const session = { user } as Session;
  const activeProfile: Profile = {
    id: 'user-1',
    email: 'staff@example.com',
    first_name: 'Staff',
    last_name: 'Member',
    display_name: 'Staff Member',
    is_active: true,
    created_at: '2026-06-02T00:00:00.000Z',
    updated_at: '2026-06-02T00:00:00.000Z',
  };

  let service: AuthService;
  let router: jasmine.SpyObj<Router>;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: {
    auth: {
      signInWithPassword: jasmine.Spy;
      resetPasswordForEmail: jasmine.Spy;
      updateUser: jasmine.Spy;
      onAuthStateChange: jasmine.Spy;
    };
    from: jasmine.Spy;
  };

  function profileQuery(profile: Profile | null, error: { message: string } | null = null) {
    return {
      select: jasmine.createSpy('select').and.returnValue({
        eq: jasmine.createSpy('eq').and.returnValue({
          maybeSingle: jasmine.createSpy('maybeSingle').and.resolveTo({ data: profile, error }),
        }),
      }),
    };
  }

  function rolesQuery(roles: Array<{ role: string }>, error: { message: string } | null = null) {
    return {
      select: jasmine.createSpy('select').and.returnValue({
        eq: jasmine.createSpy('eq').and.resolveTo({ data: roles, error }),
      }),
    };
  }

  function configureAuthService(platformId: 'browser' | 'server' = 'browser'): void {
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    client = {
      auth: {
        signInWithPassword: jasmine.createSpy('signInWithPassword').and.resolveTo({
          data: { session },
          error: null,
        }),
        resetPasswordForEmail: jasmine.createSpy('resetPasswordForEmail').and.resolveTo({ error: null }),
        updateUser: jasmine.createSpy('updateUser').and.resolveTo({ error: null }),
        onAuthStateChange: jasmine.createSpy('onAuthStateChange'),
      },
      from: jasmine.createSpy('from').and.callFake((table: string) => {
        if (table === 'profiles') {
          return profileQuery(activeProfile);
        }

        return rolesQuery([{ role: 'staff' }]);
      }),
    };

    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
      'getSession',
      'signOut',
    ]);
    supabaseService.getClient.and.returnValue(client as never);
    supabaseService.getSession.and.resolveTo(session);
    supabaseService.signOut.and.resolveTo();

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: Router, useValue: router },
        { provide: SupabaseService, useValue: supabaseService },
        { provide: PLATFORM_ID, useValue: platformId },
      ],
    });

    service = TestBed.inject(AuthService);
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('initializes server-side auth without touching Supabase', async () => {
    configureAuthService('server');

    await service.init();

    expect(service.isReady).toBeTrue();
    expect(service.isAuthenticated).toBeFalse();
    expect(service.isInternalUser).toBeFalse();
    expect(supabaseService.getSession).not.toHaveBeenCalled();
    expect(client.auth.onAuthStateChange).not.toHaveBeenCalled();
  });

  it('hydrates active internal users from session, profile, and role data', async () => {
    configureAuthService();

    await service.init();

    expect(service.isReady).toBeTrue();
    expect(service.isAuthenticated).toBeTrue();
    expect(service.isInternalUser).toBeTrue();
    expect(service.user).toBe(user);
    expect(service.session).toBe(session);
    expect(service.snapshot.profile).toEqual(activeProfile);
    expect(service.snapshot.roles).toEqual(['staff']);
    expect(client.auth.onAuthStateChange).toHaveBeenCalled();
  });

  it('resets auth state when initialization fails', async () => {
    configureAuthService();
    const consoleSpy = spyOn(console, 'error');
    supabaseService.getSession.and.rejectWith(new Error('session failed'));

    await service.init();

    expect(service.snapshot).toEqual(jasmine.objectContaining({
      initialized: true,
      loading: false,
      session: null,
      user: null,
      profile: null,
      roles: [],
      isInternalUser: false,
    }));
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('normalizes login email, hydrates internal users, and navigates to the CRM', async () => {
    configureAuthService();

    await expectAsync(service.login(' STAFF@Example.COM ', 'secret')).toBeResolvedTo(null);

    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'staff@example.com',
      password: 'secret',
    });
    expect(router.navigate).toHaveBeenCalledWith(['/admin/dashboard']);
    expect(supabaseService.signOut).not.toHaveBeenCalled();
  });

  it('signs out non-internal users after login and returns an access message', async () => {
    configureAuthService();
    client.from.and.callFake((table: string) => (
      table === 'profiles'
        ? profileQuery({ ...activeProfile, is_active: false })
        : rolesQuery([])
    ));

    await expectAsync(service.login('client@example.com', 'secret')).toBeResolvedTo(
      'Your account does not have access to the admin CRM.'
    );

    expect(supabaseService.signOut).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
    expect(service.isAuthenticated).toBeFalse();
  });

  it('returns login errors without hydrating session state', async () => {
    configureAuthService();
    client.auth.signInWithPassword.and.resolveTo({
      data: { session: null },
      error: { message: 'Invalid credentials' },
    });

    await expectAsync(service.login('staff@example.com', 'bad')).toBeResolvedTo('Invalid credentials');

    expect(service.snapshot.loading).toBeFalse();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('logs sign-out failures while still clearing state and redirecting by default', async () => {
    configureAuthService();
    const consoleSpy = spyOn(console, 'error');
    supabaseService.signOut.and.rejectWith(new Error('network'));

    await service.logout();

    expect(consoleSpy).toHaveBeenCalled();
    expect(service.isAuthenticated).toBeFalse();
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it('normalizes password reset emails and returns update errors', async () => {
    configureAuthService();
    client.auth.updateUser.and.resolveTo({ error: { message: 'Too short' } });

    await expectAsync(service.requestPasswordReset(' STAFF@Example.COM ')).toBeResolvedTo(null);
    await expectAsync(service.updatePassword('short')).toBeResolvedTo('Too short');

    expect(client.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'staff@example.com',
      { redirectTo: `${window.location.origin}/change-password` }
    );
    expect(client.auth.updateUser).toHaveBeenCalledWith({ password: 'short' });
  });
});
