import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LeadStatus } from '../../../../../core/models/lead-status';

@Component({
  selector: 'app-lead-status-selector',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-status-selector.component.html',
  styleUrl: './lead-status-selector.component.scss',
})
export class LeadStatusSelectorComponent {
  @Input({ required: true }) value!: LeadStatus;
  @Input() disabled = false;
  @Input() allowedStatuses: LeadStatus[] = [
    'new',
    'contacted',
    'consultation_scheduled',
    'nurturing',
    'proposal_submitted',
    'proposal_declined',
    'proposal_accepted',
    'accepted',
    'declined',
    'converted',
    'closed_unbooked',
  ];

  @Output() statusChange = new EventEmitter<LeadStatus>();

  formatLabel(status: LeadStatus): string {
    return status
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char: string) => char.toUpperCase());
  }

  onSelectionChange(value: string): void {
    this.statusChange.emit(value as LeadStatus);
  }
}
