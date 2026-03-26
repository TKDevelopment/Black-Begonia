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
import { LeadConversionService } from '../../../../../core/supabase/services/lead-conversion.service';

export interface LeadConvertPayload {
  project_name: string;
  internal_notes?: string | null;
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

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<LeadConvertPayload>();

  projectName = signal('');
  internalNotes = signal('');

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
    });
  }

  get hasPartnerContact(): boolean {
    return !!this.lead?.partner_first_name?.trim() || !!this.lead?.partner_last_name?.trim();
  }

  get hasPlannerContact(): boolean {
    return !!this.lead?.planner_name?.trim() || !!this.lead?.planner_email?.trim() || !!this.lead?.planner_phone?.trim();
  }

  private hydrateForm(): void {
    this.projectName.set(
      this.lead ? this.leadConversionService.buildDefaultProjectName(this.lead) : ''
    );
    this.internalNotes.set('');
  }
}
