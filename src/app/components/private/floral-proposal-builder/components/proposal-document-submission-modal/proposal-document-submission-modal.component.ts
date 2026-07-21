import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-proposal-document-submission-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-document-submission-modal.component.html',
  styleUrl: './proposal-document-submission-modal.component.scss',
})
export class ProposalDocumentSubmissionModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() fileName = '';
  @Input() progressMessage: string | null = null;
  @Input() errorMessage: string | null = null;
  @Input() canvaImportAvailable = false;
  @Input() mode: 'initial_booking' | 'project_revision' = 'initial_booking';
  @Input() depositAmount: number | null = null;
  @Input() recipientEmail: string | null = null;
  @Input() darkMode = false;

  depositEmailChoice: 'send' | 'defer' | null = null;

  @Output() closeModal = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<File | null>();
  @Output() submitDocument = new EventEmitter<boolean>();

  onOverlayClose(): void {
    if (this.saving) {
      return;
    }

    this.closeModal.emit();
    this.depositEmailChoice = null;
  }

  onFileInputChange(event: Event): void {
    if (this.saving) return;
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0] ?? null;
    this.fileSelected.emit(file);

    if (input) {
      input.value = '';
    }
  }

  onFileDrop(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (this.saving) return;
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.fileSelected.emit(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }

  onSubmit(): void {
    const hasDepositDecision =
      this.mode === 'project_revision' || this.depositEmailChoice !== null;
    if (
      !this.saving &&
      this.fileName &&
      hasDepositDecision
    ) {
      this.submitDocument.emit(this.depositEmailChoice === 'send');
    }
  }
}
