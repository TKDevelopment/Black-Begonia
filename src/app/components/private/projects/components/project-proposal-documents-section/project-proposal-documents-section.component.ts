import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed, signal } from '@angular/core';

import { ProjectProposalDocumentVersion } from '../../../../../core/models/project-proposal-document-version';
import { ProjectProposalInvoiceSnapshot } from '../../../../../core/models/project-proposal-invoice-snapshot';
import { ProjectRevisionComparisonModalComponent } from '../project-revision-comparison-modal/project-revision-comparison-modal.component';

@Component({
  selector: 'app-project-proposal-documents-section',
  standalone: true,
  imports: [CommonModule, ProjectRevisionComparisonModalComponent],
  templateUrl: './project-proposal-documents-section.component.html',
  styleUrl: './project-proposal-documents-section.component.scss',
})
export class ProjectProposalDocumentsSectionComponent {
  @Input() documents: ProjectProposalDocumentVersion[] = [];
  @Input() snapshots: ProjectProposalInvoiceSnapshot[] = [];
  @Input() loading = false;
  @Output() openPdf = new EventEmitter<ProjectProposalDocumentVersion>();

  readonly activeTab = signal<'initial' | 'revised'>('initial');
  readonly comparisonOpen = signal(false);

  readonly initialDocuments = computed(() => {
    const sorted = this.sortedDocuments();
    return sorted.length ? [sorted[0]] : [];
  });

  readonly revisedDocuments = computed(() => this.sortedDocuments().slice(1));

  readonly hasRevisions = computed(() => this.revisedDocuments().length > 0);

  readonly visibleDocuments = computed(() => {
    if (!this.hasRevisions()) {
      return this.initialDocuments();
    }

    return this.activeTab() === 'initial'
      ? this.initialDocuments()
      : this.revisedDocuments();
  });

  isDisplayActive(document: ProjectProposalDocumentVersion): boolean {
    if (document.version === this.initialDocuments()[0]?.version) {
      return !this.hasRevisions();
    }

    const latestRevised = this.revisedDocuments().at(-1);
    return latestRevised?.project_proposal_document_version_id === document.project_proposal_document_version_id;
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  displayStatus(document: ProjectProposalDocumentVersion): string {
    const storedStatus = document.status || 'submitted';
    const activityState = this.isDisplayActive(document) ? 'Active' : 'Inactive';
    return `${this.formatValue(storedStatus)} / ${activityState}`;
  }

  private sortedDocuments(): ProjectProposalDocumentVersion[] {
    return [...this.documents].sort((a, b) => a.version - b.version);
  }

  private formatValue(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
