import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Lead } from '../../../../../core/models/lead';

export interface LeadConvertPayload {
  notes?: string | null;
  createPrimaryContact: boolean;
  createProjectShell: boolean;
}

@Component({
  selector: 'app-lead-convert-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-convert-modal.component.html',
  styleUrl: './lead-convert-modal.component.scss',
})
export class LeadConvertModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() lead: Lead | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<LeadConvertPayload>();

  notes = signal('');
  createPrimaryContact = signal(true);
  createProjectShell = signal(true);

  onClose(): void {
    if (this.saving) return;

    this.notes.set('');
    this.createPrimaryContact.set(true);
    this.createProjectShell.set(true);
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit({
      notes: this.notes().trim() || null,
      createPrimaryContact: this.createPrimaryContact(),
      createProjectShell: this.createProjectShell(),
    });
  }
}