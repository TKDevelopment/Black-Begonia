import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';

import { environment } from '../../../../environments/environment';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const originalEnvironment = { ...environment };

  function restoreEnvironment(): void {
    Object.assign(environment, originalEnvironment);
  }

  beforeEach(() => {
    restoreEnvironment();
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'browser' }],
    });
  });

  afterEach(() => {
    restoreEnvironment();
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    const service = TestBed.inject(SupabaseService);

    expect(service).toBeTruthy();
    expect(service.getClient()).toBeTruthy();
  });

  it('throws a clear error when the Supabase URL is missing', () => {
    environment.supabaseUrl = '';

    expect(() => TestBed.inject(SupabaseService)).toThrowError(
      '[SupabaseService] Missing environment.supabaseUrl or environment.supabaseAnonKey.'
    );
  });

  it('throws a clear error when the Supabase anon key is missing', () => {
    environment.supabaseAnonKey = '';

    expect(() => TestBed.inject(SupabaseService)).toThrowError(
      '[SupabaseService] Missing environment.supabaseUrl or environment.supabaseAnonKey.'
    );
  });

  it('returns null and logs when session lookup fails', async () => {
    const service = TestBed.inject(SupabaseService);
    const error = new Error('session failed');
    const consoleSpy = spyOn(console, 'error');

    (service as unknown as { client: { auth: { getSession: jasmine.Spy } } }).client = {
      auth: {
        getSession: jasmine.createSpy('getSession').and.resolveTo({
          data: { session: null },
          error,
        }),
      },
    };

    await expectAsync(service.getSession()).toBeResolvedTo(null);
    expect(consoleSpy).toHaveBeenCalledWith('[SupabaseService] getSession error:', 'session failed');
  });

  it('returns null and logs when user lookup fails', async () => {
    const service = TestBed.inject(SupabaseService);
    const error = new Error('user failed');
    const consoleSpy = spyOn(console, 'error');

    (service as unknown as { client: { auth: { getUser: jasmine.Spy } } }).client = {
      auth: {
        getUser: jasmine.createSpy('getUser').and.resolveTo({
          data: { user: null },
          error,
        }),
      },
    };

    await expectAsync(service.getUser()).toBeResolvedTo(null);
    expect(consoleSpy).toHaveBeenCalledWith('[SupabaseService] getUser error:', 'user failed');
  });

  it('rethrows sign-out failures after logging them', async () => {
    const service = TestBed.inject(SupabaseService);
    const error = new Error('sign out failed');
    const consoleSpy = spyOn(console, 'error');

    (service as unknown as { client: { auth: { signOut: jasmine.Spy } } }).client = {
      auth: {
        signOut: jasmine.createSpy('signOut').and.resolveTo({ error }),
      },
    };

    await expectAsync(service.signOut()).toBeRejectedWith(error);
    expect(consoleSpy).toHaveBeenCalledWith('[SupabaseService] signOut error:', 'sign out failed');
  });
});
