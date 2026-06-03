import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-proposal-document-submission-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './proposal-document-submission-modal.component.html',
})
export class ProposalDocumentSubmissionModalComponent {
  @Input() open = false;
  @Input() saving = false;
  @Input() fileName = '';
  @Input() errorMessage: string | null = null;
  @Input() canvaImportAvailable = false;

  @Output() closeModal = new EventEmitter<void>();
  @Output() fileSelected = new EventEmitter<File | null>();
  @Output() submitDocument = new EventEmitter<void>();

  onOverlayClose(): void {
    if (this.saving) {
      return;
    }

    this.closeModal.emit();
  }

  onFileInputChange(event: Event): void {
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
    const file = event.dataTransfer?.files?.[0] ?? null;
    this.fileSelected.emit(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    event.stopPropagation();
  }
}
