import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { ProjectProposalDocumentVersion } from '../../../../../core/models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../../../../core/models/project-proposal-invoice-snapshot';

@Component({
  selector: 'app-project-revision-comparison-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './project-revision-comparison-modal.component.html',
  styleUrl: './project-revision-comparison-modal.component.scss',
})
export class ProjectRevisionComparisonModalComponent {
  @Input() open = false;
  @Input() documents: ProjectProposalDocumentVersion[] = [];
  @Input() snapshots: ProjectProposalInvoiceSnapshot[] = [];
  @Output() close = new EventEmitter<void>();

  fromDocumentId = '';
  toDocumentId = '';

  get comparableDocuments(): ProjectProposalDocumentVersion[] {
    return this.documents.filter((document) => document.version > 1);
  }

  get fromDocument(): ProjectProposalDocumentVersion | null {
    return this.documents.find((document) => document.project_proposal_document_version_id === this.fromDocumentId) ?? null;
  }

  get toDocument(): ProjectProposalDocumentVersion | null {
    return this.documents.find((document) => document.project_proposal_document_version_id === this.toDocumentId) ?? null;
  }

  get fromSnapshot(): ProjectProposalInvoiceSnapshot | null {
    return this.findSnapshot(this.fromDocument);
  }

  get toSnapshot(): ProjectProposalInvoiceSnapshot | null {
    return this.findSnapshot(this.toDocument);
  }

  get hasSelection(): boolean {
    return !!this.fromDocument && !!this.toDocument && this.fromDocumentId !== this.toDocumentId;
  }

  totalChanged(): string {
    if (!this.fromSnapshot || !this.toSnapshot) {
      return 'Unavailable';
    }

    return this.fromSnapshot.total_amount === this.toSnapshot.total_amount ? 'No' : 'Yes';
  }

  formatCurrency(value: number | null | undefined): string {
    if (value === null || value === undefined) {
      return 'Unavailable';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Unavailable';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private findSnapshot(
    document: ProjectProposalDocumentVersion | null
  ): ProjectProposalInvoiceSnapshot | null {
    if (!document?.invoice_snapshot_id) {
      return null;
    }

    return this.snapshots.find(
      (snapshot) => snapshot.project_proposal_invoice_snapshot_id === document.invoice_snapshot_id
    ) ?? null;
  }
}
