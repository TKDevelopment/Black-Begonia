import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

import { ActivityLogEntry } from '../../../../../core/models/activity-log';

@Component({
  selector: 'app-project-activity-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './project-activity-panel.component.html',
  styleUrl: './project-activity-panel.component.scss',
})
export class ProjectActivityPanelComponent {
  @Input() activities: ActivityLogEntry[] = [];

  metadataEntries(activity: ActivityLogEntry): Array<{ key: string; value: string }> {
    const metadata = activity.metadata ?? {};

    return Object.entries(metadata)
      .filter(([key]) => !['submission_idempotency_key', 'new_snapshot_id', 'new_document_id'].includes(key))
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        key: this.formatMetadataKey(key),
        value: this.formatMetadataValue(value),
      }));
  }

  actorName(activity: ActivityLogEntry): string {
    return activity.performed_by_display_name?.trim()
      || activity.performed_by_email?.trim()
      || 'Unknown user';
  }

  formatDateTime(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  private formatMetadataKey(key: string): string {
    return key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatMetadataValue(value: unknown): string {
    if (Array.isArray(value)) {
      return value.map((entry) => this.formatMetadataValue(entry)).join(', ');
    }

    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value);
    }

    return String(value).replace(/_/g, ' ');
  }
}
