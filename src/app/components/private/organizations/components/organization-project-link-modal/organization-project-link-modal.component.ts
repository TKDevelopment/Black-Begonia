import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, SimpleChanges, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Project } from '../../../../../core/models/project';
import { ProjectOrganizationRelationship } from '../../../../../core/models/project-organization';

export interface OrganizationProjectLinkPayload {
  project_id: string;
  relationship_type: ProjectOrganizationRelationship;
}

@Component({
  selector: 'app-organization-project-link-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './organization-project-link-modal.component.html',
})
export class OrganizationProjectLinkModalComponent {
  readonly relationshipOptions: ProjectOrganizationRelationship[] = [
    'venue',
    'planner_company',
    'vendor',
    'corporate_client',
    'other',
  ];

  @Input() open = false;
  @Input() saving = false;
  @Input() projects: Project[] = [];

  @Output() close = new EventEmitter<void>();
  @Output() confirm = new EventEmitter<OrganizationProjectLinkPayload>();

  readonly projectId = signal('');
  readonly relationshipType = signal<ProjectOrganizationRelationship>('vendor');
  readonly validationError = signal<string | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open']?.currentValue) {
      this.projectId.set('');
      this.relationshipType.set('vendor');
      this.validationError.set(null);
    }
  }

  onClose(): void {
    if (this.saving) return;
    this.validationError.set(null);
    this.close.emit();
  }

  onConfirm(): void {
    if (!this.projectId()) {
      this.validationError.set('Select a project before linking this organization.');
      return;
    }

    this.validationError.set(null);
    this.confirm.emit({
      project_id: this.projectId(),
      relationship_type: this.relationshipType(),
    });
  }

  formatProjectLabel(project: Project): string {
    const date = project.event_date
      ? new Intl.DateTimeFormat('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }).format(new Date(project.event_date))
      : 'Date TBD';

    return `${project.project_name} • ${date}`;
  }

  formatLabel(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }
}
