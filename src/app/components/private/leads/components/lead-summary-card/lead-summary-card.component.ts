import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';
import { Lead } from '../../../../../core/models/lead';
import { LeadStatus } from '../../../../../core/models/lead-status';
import { StatusBadgeComponent } from '../../../../../shared/components/private/status-badge/status-badge.component';

type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger'
  | 'purple';

@Component({
  selector: 'app-lead-summary-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './lead-summary-card.component.html',
  styleUrl: './lead-summary-card.component.scss',
})
export class LeadSummaryCardComponent {
  @Input({ required: true }) lead!: Lead;
  @Input() actionLoading = false;
  @Input() consultationButtonLabel = 'Schedule Consultation';
  @Input() consultationButtonDisabled = false;

  @Output() markContacted = new EventEmitter<void>();
  @Output() editLead = new EventEmitter<void>();
  @Output() convertLead = new EventEmitter<void>();
  @Output() consultationAction = new EventEmitter<void>();
  @Output() declineLead = new EventEmitter<void>();

  getInitials(): string {
    const first = this.lead?.first_name?.charAt(0) ?? '';
    const last = this.lead?.last_name?.charAt(0) ?? '';
    return `${first}${last}`.toUpperCase() || '--';
  }

  getPartnerName(): string {
    const first = this.lead?.partner_first_name?.trim() ?? '';
    const last = this.lead?.partner_last_name?.trim() ?? '';
    const full = `${first} ${last}`.trim();
    return full || 'Not provided';
  }

  getLeadStatusTone(status: LeadStatus): BadgeTone {
    switch (status) {
      case 'new':
        return 'info';
      case 'contacted':
        return 'neutral';
      case 'consultation_scheduled':
        return 'warning';
      case 'nurturing':
        return 'purple';
      case 'accepted':
      case 'converted':
        return 'success';
      case 'declined':
        return 'danger';
      case 'closed_unbooked':
      default:
        return 'neutral';
    }
  }
}