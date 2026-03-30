import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lead-note-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-note-modal.component.html',
  styleUrl: './lead-note-modal.component.scss',
})
export class LeadNoteModalComponent {
  @Input() open = false;
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  readonly note = signal('');
  readonly validationError = signal<string | null>(null);

  onClose(): void {
    if (this.saving) return;
    this.note.set('');
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    const value = this.note().trim();
    if (!value) {
      this.validationError.set('Please enter a note before saving.');
      return;
    }

    this.validationError.set(null);
    this.confirm.emit(value);
  }
}
