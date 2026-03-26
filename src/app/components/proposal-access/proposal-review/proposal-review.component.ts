import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { ProposalAccessService } from '../../../core/proposal-access/proposal-access.service';

@Component({
  selector: 'app-proposal-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-review.component.html',
})
export class ProposalReviewComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly proposalAccessService = inject(ProposalAccessService);

  readonly session = computed(() => this.proposalAccessService.getSession());
  readonly previewUrl = computed<SafeResourceUrl | null>(() => {
    const session = this.session();
    if (!session?.signed_url) return null;

    return this.sanitizer.bypassSecurityTrustResourceUrl(session.signed_url);
  });
  readonly hasResponded = computed(() => !!this.session()?.response_action);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly completedAction = signal<'accept' | 'decline' | null>(null);
  readonly declineModalOpen = signal(false);
  readonly acceptModalOpen = signal(false);
  readonly declineFeedback = signal('');
  readonly declineModalState = signal<'form' | 'submitting' | 'success'>('form');
  readonly acceptModalState = signal<'confirm' | 'submitting' | 'success'>('confirm');

  ngOnInit(): void {
    if (!this.proposalAccessService.hasValidSession()) {
      void this.router.navigate(['/proposal/auth']);
      return;
    }

    const session = this.proposalAccessService.getSession();
    if (session?.response_action) {
      this.completedAction.set(session.response_action);
      this.successMessage.set(
        session.response_action === 'accept'
          ? 'This proposal has already been accepted.'
          : 'This proposal has already been declined and your feedback was received.'
      );
    }
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return 'Not provided';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not provided';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  openAcceptModal(): void {
    if (this.submitting() || this.completedAction()) return;
    this.acceptModalOpen.set(true);
    this.acceptModalState.set('confirm');
    this.errorMessage.set(null);
  }

  closeAcceptModal(): void {
    if (this.submitting()) return;
    this.acceptModalOpen.set(false);
    this.acceptModalState.set('confirm');
  }

  openDeclineModal(): void {
    if (this.submitting() || this.completedAction()) return;
    this.declineModalOpen.set(true);
    this.declineModalState.set('form');
    this.errorMessage.set(null);
  }

  closeDeclineModal(): void {
    if (this.submitting()) return;
    this.declineModalOpen.set(false);
    this.declineModalState.set('form');
    this.declineFeedback.set('');
  }

  async confirmAccept(): Promise<void> {
    if (this.submitting() || this.completedAction()) return;

    try {
      this.submitting.set(true);
      this.acceptModalState.set('submitting');
      this.errorMessage.set(null);
      this.successMessage.set(null);

      await this.proposalAccessService.submitResponse('accept');
      this.completedAction.set('accept');
      this.successMessage.set('Your proposal has been accepted successfully.');
      this.acceptModalState.set('success');
    } catch (error) {
      console.error('[ProposalReviewComponent] confirmAccept error:', error);
      this.acceptModalState.set('confirm');
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'We could not save your response right now.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async confirmDecline(): Promise<void> {
    if (this.submitting() || this.completedAction()) return;

    const feedback = this.declineFeedback().trim();
    if (!feedback) {
      this.errorMessage.set('Please share a few notes so we can revise the proposal thoughtfully.');
      return;
    }

    try {
      this.submitting.set(true);
      this.declineModalState.set('submitting');
      this.errorMessage.set(null);
      this.successMessage.set(null);

      await this.proposalAccessService.submitResponse('decline', feedback);
      this.completedAction.set('decline');
      this.successMessage.set(
        'Your message was received and the proposal was declined successfully.'
      );
      this.declineModalState.set('success');
    } catch (error) {
      console.error('[ProposalReviewComponent] confirmDecline error:', error);
      this.declineModalState.set('form');
      this.errorMessage.set(
        error instanceof Error
          ? error.message
          : 'We could not save your response right now.'
      );
    } finally {
      this.submitting.set(false);
    }
  }

  async signOut(): Promise<void> {
    this.proposalAccessService.clearSession();
    await this.router.navigate(['/proposal/auth']);
  }
}

