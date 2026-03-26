import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  inject,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-lead-proposal-submit-modal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './lead-proposal-submit-modal.component.html',
  styleUrl: './lead-proposal-submit-modal.component.scss',
})
export class LeadProposalSubmitModalComponent implements OnDestroy {
  private sanitizer = inject(DomSanitizer);

  @Input() open = false;
  @Input() saving = false;
  @Input() leadName = 'this lead';

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<File>();

  selectedFile = signal<File | null>(null);
  previewUrl = signal<SafeResourceUrl | null>(null);
  dragActive = signal(false);

  private objectUrl: string | null = null;

  ngOnDestroy(): void {
    this.revokeObjectUrl();
  }

  onClose(): void {
    if (this.saving) return;

    this.resetSelection();
    this.close.emit();
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.setSelectedFile(file);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);

    const file = event.dataTransfer?.files?.[0] ?? null;
    this.setSelectedFile(file);
  }

  clearFile(): void {
    if (this.saving) return;
    this.resetSelection();
  }

  onConfirm(): void {
    const file = this.selectedFile();
    if (!file || this.saving) return;

    this.confirm.emit(file);
  }

  private setSelectedFile(file: File | null): void {
    if (!file) {
      this.resetSelection();
      return;
    }

    if (file.type !== 'application/pdf') {
      this.resetSelection();
      return;
    }

    this.revokeObjectUrl();

    this.selectedFile.set(file);
    this.objectUrl = URL.createObjectURL(file);
    this.previewUrl.set(
      this.sanitizer.bypassSecurityTrustResourceUrl(this.objectUrl)
    );
  }

  private resetSelection(): void {
    this.selectedFile.set(null);
    this.previewUrl.set(null);
    this.dragActive.set(false);
    this.revokeObjectUrl();
  }

  private revokeObjectUrl(): void {
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
  }
}
