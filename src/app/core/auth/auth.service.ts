import { Inject, Injectable, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { BehaviorSubject, Observable } from 'rxjs';
import { SupabaseService } from '../supabase/clients/supabase.service';
import { AuthState, CrmUserRole, Profile } from './auth.models';

const INITIAL_AUTH_STATE: AuthState = {
  initialized: false,
  loading: true,
  session: null,
  user: null,
  profile: null,
  roles: [],
  isInternalUser: false,
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly stateSubject = new BehaviorSubject<AuthState>(INITIAL_AUTH_STATE);
  private initPromise: Promise<void> | null = null;
  private authListenerRegistered = false;
  private readonly isBrowser: boolean;

  readonly state$: Observable<AuthState> = this.stateSubject.asObservable();

  constructor(
    private readonly router: Router,
    private readonly supabaseService: SupabaseService,
    @Inject(PLATFORM_ID) platformId: object
  ) {
    this.isBrowser = isPlatformBrowser(platformId);

    if (this.isBrowser) {
      this.registerAuthListener();
    }
  }

  get snapshot(): AuthState {
    return this.stateSubject.value;
  }

  get isReady(): boolean {
    return this.snapshot.initialized;
  }

  get isAuthenticated(): boolean {
    return !!this.snapshot.user;
  }

  get isInternalUser(): boolean {
    return this.snapshot.isInternalUser;
  }

  get user(): User | null {
    return this.snapshot.user;
  }

  get session(): Session | null {
    return this.snapshot.session;
  }

  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    if (!this.isBrowser) {
      this.patchState({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        profile: null,
        roles: [],
        isInternalUser: false,
      });
      this.initPromise = Promise.resolve();
      return this.initPromise;
    }

    this.initPromise = this.runInit();
    return this.initPromise;
  }

  private async runInit(): Promise<void> {
    this.patchState({ loading: true });

    try {
      const session = await this.supabaseService.getSession();
      await this.hydrateFromSession(session);
    } catch (error) {
      console.error('[AuthService] init failed:', error);
      this.patchState({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        profile: null,
        roles: [],
        isInternalUser: false,
      });
    }
  }

  async login(email: string, password: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    this.patchState({ loading: true });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error) {
      this.patchState({ loading: false });
      return error.message || 'Unable to sign in.';
    }

    await this.hydrateFromSession(data.session ?? null);

    if (this.snapshot.isInternalUser) {
      await this.router.navigate(['/admin/dashboard']);
      return null;
    }

    await this.logout(false);
    return 'Your account does not have access to the admin CRM.';
  }

  async logout(redirect = true): Promise<void> {
    try {
      await this.supabaseService.signOut();
    } catch (error) {
      console.error('[AuthService] logout error:', error);
    } finally {
      this.patchState({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        profile: null,
        roles: [],
        isInternalUser: false,
      });

      if (redirect) {
        await this.router.navigate(['/login']);
      }
    }
  }

  async refresh(): Promise<void> {
    const session = await this.supabaseService.getSession();
    await this.hydrateFromSession(session);
  }

  async requestPasswordReset(email: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      {
        redirectTo: `${window.location.origin}/change-password`
      }
    );

    return error ? error.message : null;
  }

  async updatePassword(newPassword: string): Promise<string | null> {
    const supabase = this.supabaseService.getClient();

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    return error ? error.message : null;
  }

  private registerAuthListener(): void {
    if (this.authListenerRegistered) {
      return;
    }

    this.authListenerRegistered = true;

    const supabase = this.supabaseService.getClient();

    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session) => {
      setTimeout(() => {
        void this.handleAuthStateChange(event, session);
      }, 0);
    });
  }

  private async handleAuthStateChange(
    event: AuthChangeEvent,
    session: Session | null
  ): Promise<void> {
    if (event === 'SIGNED_OUT') {
      this.patchState({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        profile: null,
        roles: [],
        isInternalUser: false,
      });
      return;
    }

    await this.hydrateFromSession(session);
  }

  private async hydrateFromSession(session: Session | null): Promise<void> {
    const user = session?.user ?? null;

    if (!user) {
      this.patchState({
        initialized: true,
        loading: false,
        session: null,
        user: null,
        profile: null,
        roles: [],
        isInternalUser: false,
      });
      return;
    }

    this.patchState({
      session,
      user,
      loading: true,
    });

    const [profile, roles] = await Promise.all([
      this.fetchProfile(user.id),
      this.fetchRoles(user.id),
    ]);

    const isInternalUser = !!profile?.is_active && roles.length > 0;

    this.patchState({
      initialized: true,
      loading: false,
      session,
      user,
      profile,
      roles,
      isInternalUser,
    });
  }

  private async fetchProfile(userId: string): Promise<Profile | null> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('profiles')
      .select(`
        id,
        email,
        first_name,
        last_name,
        display_name,
        is_active,
        created_at,
        updated_at
      `)
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[AuthService] fetchProfile error:', error.message);
      return null;
    }

    return data ?? null;
  }

  private async fetchRoles(userId: string): Promise<CrmUserRole[]> {
    const supabase = this.supabaseService.getClient();

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      console.error('[AuthService] fetchRoles error:', error.message);
      return [];
    }

    return (data ?? [])
      .map(row => row.role as CrmUserRole)
      .filter(role => role === 'admin' || role === 'staff');
  }

  private patchState(partial: Partial<AuthState>): void {
    this.stateSubject.next({
      ...this.stateSubject.value,
      ...partial,
    });
  }
}
