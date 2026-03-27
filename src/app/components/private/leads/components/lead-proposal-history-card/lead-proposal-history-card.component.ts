import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

import { FloralProposal } from '../../../../../core/models/floral-proposal';
import { FloralProposalResponseSummary } from '../../../../../core/models/floral-proposal';

@Component({
  selector: 'app-lead-proposal-history-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lead-proposal-history-card.component.html',
  styleUrl: './lead-proposal-history-card.component.scss',
})
export class LeadProposalHistoryCardComponent {
  private sanitizer = inject(DomSanitizer);

  @Input() proposals: FloralProposal[] = [];
  @Input() selectedProposalId: string | null = null;
  @Input() proposalResponses: Record<string, FloralProposalResponseSummary[]> = {};
  @Input() resending = false;
  @Input() canSubmitProposal = false;
  @Input() canResendProposal = true;

  @Output() selectProposal = new EventEmitter<string>();
  @Output() openProposal = new EventEmitter<string>();
  @Output() resendProposal = new EventEmitter<string>();
  @Output() submitProposal = new EventEmitter<void>();

  selectedProposal = computed(() => {
    if (!this.proposals.length) return null;

    if (this.selectedProposalId) {
      return (
        this.proposals.find(
          (proposal) => proposal.floral_proposal_id === this.selectedProposalId
        ) ?? this.proposals[0]
      );
    }

    return this.proposals[0];
  });

  getPreviewUrl(url: string | null | undefined): SafeResourceUrl | null {
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  getLatestResponse(proposalId: string): FloralProposalResponseSummary | null {
    return this.proposalResponses[proposalId]?.[0] ?? null;
  }

  onSelect(proposalId: string): void {
    this.selectProposal.emit(proposalId);
  }

  onOpen(url: string | null | undefined): void {
    if (!url) return;
    this.openProposal.emit(url);
  }

  onResend(proposalId: string): void {
    if (!this.canResendProposal) return;
    this.resendProposal.emit(proposalId);
  }

  onSubmitProposal(): void {
    this.submitProposal.emit();
  }
}


