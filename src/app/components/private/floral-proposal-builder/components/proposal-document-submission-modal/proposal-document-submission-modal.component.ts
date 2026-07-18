import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-proposal-document-submission-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './proposal-document-submission-modal.component.html',
})
export class ProposalDocumentSubmissionModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() fileName = '';
  @Input() progressMessage: string | null = null;
  @Input() errorMessage: string | null = null;
  @Input() canvaImportAvailable = false;
  @Input() mode: 'initial_booking' | 'project_revision' = 'initial_booking';

  approvedSignedAcknowledged = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<File | null>();
  @Output() submitDocument = new EventEmitter<void>();

  onOverlayClose(): void {
    if (this.saving) {
      return;
    }

    this.closeModal.emit();
    this.approvedSignedAcknowledged = false;
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
    if (!this.saving && this.fileName && this.approvedSignedAcknowledged) {
      this.submitDocument.emit();
    }
  }
}
