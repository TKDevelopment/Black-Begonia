import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SupabaseService } from './supabase.service';
import { BehaviorSubject, map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private supabase: SupabaseClient;
  private loginAttempts: Record<string, number> = {};
  private session: Session | null = null;

  private sessionReady = new BehaviorSubject<boolean>(false);
  sessionReady$ = this.sessionReady.asObservable();

  private userSubject = new BehaviorSubject<User | null>(null);
  user$ = this.userSubject.asObservable();

  constructor(
    private router: Router, 
    private supabaseService: SupabaseService) 
  {
    this.supabase = this.supabaseService.getClient();

    this.supabase.auth.getSession().then(({ data: { session } }) => {
      this.session = session;
      this.userSubject.next(session?.user || null);
      this.cacheProviderToken(session);
    }).finally(() => {
      this.sessionReady.next(true);
    });;

    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session = session ?? null;
      this.userSubject.next(session?.user || null);
      this.cacheProviderToken(session);
    });
  }

  async handleOAuthRedirect(): Promise<void> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error_desc = params.get('error_description');
    if (error_desc) {
      console.error('OAuth error:', error_desc);
      return;
    }
    if (!code) return;

    const { data, error } = await this.supabase.auth.exchangeCodeForSession(window.location.search);
    if (error) {
      console.error('exchangeCodeForSession error:', error.message);
      return;
    }

    this.session = data.session;
    this.userSubject.next(this.session?.user || null);
    this.cacheProviderToken(this.session);

    // Clean URL & go to dashboard
    params.delete('code');
    params.delete('state');
    window.history.replaceState({}, '', window.location.pathname);
    this.router.navigate(['/private/dashboard']);
  }

  async loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/private/dashboard`;
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
        queryParams: { prompt: 'consent', access_type: 'offline' }
      }
    });
    if (error) console.error('signInWithOAuth error:', error.message);
  }

  async init(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      this.session = data.session;
      this.userSubject.next(this.session?.user || null);
      this.cacheProviderToken(this.session);
      this.sessionReady.next(true);
    } catch (e) {
      console.error('AuthService init failed:', e);
      this.sessionReady.next(true);
    }
  }

  isAuthenticated(): Observable<boolean> {
    return this.user$.pipe(map(user => !!user));
  }

  isLoggedIn(): boolean {
    return !!this.session?.user;
  }

  async login(email: string, password: string): Promise<string | null> {
    try {
      const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });

      if (error) {
        console.warn('⚠️ Supabase login error:', error.message);
        return this.handleFailedAttempt(email);
      }

      const user = data.user;
      this.resetAttempts(email);

      const { data: refreshedSession } = await this.supabase.auth.getSession();
      this.session = refreshedSession?.session || null;
      this.userSubject.next(this.session?.user || null);
      this.cacheProviderToken(this.session);
      this.router.navigate(['/private/dashboard']);

      return null;
    } catch (err) {
      console.error('🔥 Unexpected login error:', err);
      return 'Unexpected error during login.';
    }
  }

  logout(): void {
    this.supabaseService.signOut();
    this.session = null;
    this.userSubject.next(null);
    this.router.navigate(['/auth/login']);
  }

  async getUser(): Promise<User | null> {
    return this.supabaseService.getUser();
  }

  getSession(): Session | null {
    return this.session;
  }

  async verifyPasscode(email: string, passcode: string): Promise<boolean> {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      
      const { data, error } = await this.supabase
        .from('events')
        .select(`*, client:clients!inner(client_id, email), passcode:passcodes!inner(passcode)`)
        .eq('passcode.passcode', passcode)
        .eq('client.email', normalizedEmail)
        .single();

      if (error || !data) { return false; }

      console.log('Passcode data:', data);

      this.router.navigate(['/view/proposal'], { state: { eventId: data.event_id } });
      return true;
    } catch (err) {
      return false;
    }
  }

  private cacheProviderToken(session: Session | null | undefined) {
    const providerToken = (session as any)?.provider_token as string | undefined;
    if (providerToken) {
      localStorage.setItem('google_access_token', providerToken);
    }
    if (!session) {
      localStorage.removeItem('google_access_token');
    }
  }

  private handleFailedAttempt(email: string): string {
    const attempts = (this.loginAttempts[email] || 0) + 1;
    this.loginAttempts[email] = attempts;

    if (attempts >= 5) return 'Too many failed attempts. Please try again later.';
    if (attempts >= 3) return `Incorrect username or password. You have ${5 - attempts} attempts remaining.`;

    return 'Incorrect username or password. Please try again.';
  }

  private resetAttempts(email: string): void {
    this.loginAttempts[email] = 0;
  }
}
