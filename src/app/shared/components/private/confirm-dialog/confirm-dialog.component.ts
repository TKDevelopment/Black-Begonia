import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.scss',
})
export class ConfirmDialogComponent {
  @Input() open = false;
  @Input() title = 'Confirm Action';
  @Input() description = 'Are you sure you want to continue?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel = 'Cancel';
  @Input() tone: 'default' | 'danger' | 'success' = 'default';
  @Input() loading = false;

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<void>();

  get confirmButtonClasses(): string {
    switch (this.tone) {
      case 'danger':
        return 'bg-rose-600 hover:opacity-90 text-white';
      case 'success':
        return 'bg-emerald-600 hover:opacity-90 text-white';
      default:
        return 'bg-[#ea938c] hover:opacity-90 text-white';
    }
  }

  onClose(): void {
    if (this.loading) return;
    this.close.emit();
  }

  onConfirm(): void {
    if (this.loading) return;
    this.confirm.emit();
  }
}