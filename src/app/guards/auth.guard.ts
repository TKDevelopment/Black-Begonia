// src/app/guards/auth-guard.ts
import { CanActivateChildFn } from '@angular/router';
import { inject } from '@angular/core';
import { SupabaseService } from '../services/supabase.service';

export const authGuard: CanActivateChildFn = async (_childRoute, state) => {
  const supabase = inject(SupabaseService).getClient();

  const nowSec = Math.floor(Date.now() / 1000);
  const leeway = 30;

  const { data } = await supabase.auth.getSession();
  const session = data?.session ?? null;

  if (
    session?.access_token &&
    typeof session.expires_at === 'number' &&
    session.expires_at > nowSec + leeway
  ) {
    return true;
  }

  if (session) {
    try {
      const { data: r, error: re } = await supabase.auth.refreshSession();
      if (r?.session && !re) {
        const s = r.session;
        if (
          s.access_token &&
          typeof s.expires_at === 'number' &&
          s.expires_at > Math.floor(Date.now() / 1000) + leeway
        ) {
          return true;
        }
      }
    } catch (e) {
      console.error('[authGuard] refresh threw', e);
    }
  } else {
    console.error('[authGuard] no session from getSession()');
  }

  console.warn('[authGuard] deny -> redirect to public site');
  if (typeof window !== 'undefined') {
    window.location.assign('https://localhost:4200/');
  }
  return false;
};
