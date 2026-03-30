import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-lead-decline-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './lead-decline-modal.component.html',
  styleUrl: './lead-decline-modal.component.scss',
})
export class LeadDeclineModalComponent {
  @Input() open = false;
  @Input() saving = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<string>();

  reason = signal('');

  onClose(): void {
    if (this.saving) return;
    this.reason.set('');
    this.close.emit();
  }

  onConfirm(): void {
    this.confirm.emit(this.reason().trim());
  }
}