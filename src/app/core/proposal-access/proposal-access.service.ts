import { Injectable, signal } from '@angular/core';

import { SupabaseService } from '../supabase/clients/supabase.service';
import {
  ProposalAccessSession,
  VerifyProposalAccessResponse,
} from './proposal-access.models';

@Injectable({
  providedIn: 'root',
})
export class ProposalAccessService {
  private readonly storageKey = 'bb.floral-proposal-access-session';

  readonly session = signal<ProposalAccessSession | null>(null);

  constructor(private readonly supabaseService: SupabaseService) {
    this.hydrateSession();
  }

  hasValidSession(): boolean {
    const session = this.session();
    if (!session) return false;

    const expiresAt = new Date(session.expires_at).getTime();
    if (Number.isNaN(expiresAt) || expiresAt <= Date.now()) {
      this.clearSession();
      return false;
    }

    return true;
  }

  hasResponded(): boolean {
    const session = this.getSession();
    return !!session?.response_action;
  }

  getSession(): ProposalAccessSession | null {
    return this.hasValidSession() ? this.session() : null;
  }

  async verifyAccess(
    email: string,
    passcode: string
  ): Promise<ProposalAccessSession> {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPasscode = passcode.trim();

    const { data, error } = await this.supabaseService.getClient().functions.invoke(
      'verify-floral-proposal-access',
      {
        body: {
          email: normalizedEmail,
          passcode: normalizedPasscode,
        },
      }
    );

    if (error) {
      console.error(
        '[ProposalAccessService] verifyAccess invoke error:',
        error
      );
      throw new Error('We could not verify your Floral Proposal access right now.');
    }

    const response = (data ?? null) as
      | (VerifyProposalAccessResponse & { error?: string })
      | null;

    if (!response?.success || !response.session) {
      throw new Error(
        response?.error || 'The email or passcode you entered is not valid.'
      );
    }

    this.persistSession(response.session);
    return response.session;
  }

  async submitResponse(args: {
    action: 'accept' | 'decline';
    feedback?: string;
    accepted_terms?: boolean;
    accepted_privacy_policy?: boolean;
    signature_name?: string;
  }): Promise<{ success: boolean; lead_status: string; action: string }> {
    const session = this.getSession();

    if (!session) {
      throw new Error('Your Floral Proposal access session has expired.');
    }

    if (session.response_action) {
      throw new Error(
        'This Floral Proposal has already received a response and can no longer be updated.'
      );
    }

    const { data, error } = await this.supabaseService.getClient().functions.invoke(
      'submit-floral-proposal-response',
      {
        body: {
          floral_proposal_id: session.floral_proposal_id,
          access_token: session.access_token,
          action: args.action,
          feedback: args.feedback?.trim() || null,
          accepted_terms: args.accepted_terms ?? false,
          accepted_privacy_policy: args.accepted_privacy_policy ?? false,
          signature_name: args.signature_name?.trim() || null,
        },
      }
    );

    if (error) {
      console.error(
        '[ProposalAccessService] submitResponse invoke error:',
        error
      );
      throw new Error('We could not submit your Floral Proposal response right now.');
    }

    const response = (data ?? null) as
      | { success: boolean; lead_status: string; action: string; error?: string }
      | null;

    if (!response?.success) {
      throw new Error(
        response?.error || 'We could not save your Floral Proposal response.'
      );
    }

    const nextSession: ProposalAccessSession = {
      ...session,
      response_action: args.action,
      response_feedback:
        args.action === 'decline' ? args.feedback?.trim() || null : null,
      responded_at: new Date().toISOString(),
    };
    this.persistSession(nextSession);

    return response;
  }

  clearSession(): void {
    this.session.set(null);

    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(this.storageKey);
    }
  }

  private hydrateSession(): void {
    if (typeof window === 'undefined') return;

    const raw = window.sessionStorage.getItem(this.storageKey);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as ProposalAccessSession;
      this.session.set(parsed);

      if (!this.hasValidSession()) {
        this.clearSession();
      }
    } catch (error) {
      console.error('[ProposalAccessService] hydrateSession error:', error);
      this.clearSession();
    }
  }

  private persistSession(session: ProposalAccessSession): void {
    this.session.set(session);

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(session));
    }
  }
}
