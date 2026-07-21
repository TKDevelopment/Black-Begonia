import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Lead } from '../../../../../core/models/lead';
import { FloralProposal } from '../../../../../core/models/floral-proposal';
import { LeadConversionService } from '../../../../../core/supabase/services/lead-conversion.service';
import { formatDateOnlyForDisplay } from '../../../../../core/utils/date-only';

export interface LeadConvertPayload {
  project_name: string;
  internal_notes?: string | null;
  send_deposit_request: boolean;
}

@Component({
  selector: 'app-lead-convert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-convert-modal.component.html',
  styleUrl: './lead-convert-modal.component.scss',
})
export class LeadConvertModalComponent {
  private readonly leadConversionService = inject(LeadConversionService);

  @Input() open = false;
  @Input() saving = false;
  @Input() lead: Lead | null = null;
  @Input() proposal: FloralProposal | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<LeadConvertPayload>();

  projectName = signal('');
  internalNotes = signal('');
  sendDepositRequest = signal(true);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.hydrateForm();
    }

    if (changes['lead'] && this.open) {
      this.hydrateForm();
    }
  }

  onClose(): void {
    if (this.saving) return;

    this.projectName.set('');
    this.internalNotes.set('');
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit({
      project_name: this.projectName().trim(),
      internal_notes: this.internalNotes().trim() || null,
      send_deposit_request: this.sendDepositRequest() && this.hasEligibleRecipient,
    });
  }

  get hasPartnerContact(): boolean {
    return !!this.lead?.partner_first_name?.trim() || !!this.lead?.partner_last_name?.trim();
  }

  get hasPlannerContact(): boolean {
    return !!this.lead?.planner_name?.trim() || !!this.lead?.planner_email?.trim() || !!this.lead?.planner_phone?.trim();
  }

  get depositAmount(): number | null {
    return this.proposal ? Math.round(Number(this.proposal.total_amount) * 30) / 100 : null;
  }

  get hasEligibleRecipient(): boolean {
    return !!this.lead?.email?.trim();
  }

  formatEventDate(value: string | null | undefined): string {
    return formatDateOnlyForDisplay(value, '', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private hydrateForm(): void {
    this.projectName.set(
      this.lead ? this.leadConversionService.buildDefaultProjectName(this.lead) : ''
    );
    this.internalNotes.set('');
    this.sendDepositRequest.set(this.hasEligibleRecipient);
  }
}
