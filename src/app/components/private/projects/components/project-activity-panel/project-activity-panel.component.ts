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
    const visibleKeys = new Set([
      'amount',
      'delivery_kind',
      'method',
      'new_version',
      'next_status',
      'outcome',
      'payment_kind',
      'principal_amount',
      'reason',
      'status',
    ]);

    return Object.entries(metadata)
      .filter(([key]) => visibleKeys.has(key.toLowerCase()))
      .filter(([, value]) => value !== null && value !== undefined && value !== '')
      .map(([key, value]) => ({
        key: this.formatMetadataKey(key),
        value: this.formatActivityValue(key, value),
      }))
      .slice(0, 4);
  }

  actorName(activity: ActivityLogEntry): string {
    return activity.performed_by_display_name?.trim()
      || activity.performed_by_email?.trim()
      || (activity.actor_type ? this.formatMetadataValue(activity.actor_type) : 'System');
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

  activityCountLabel(): string {
    return `${this.activities.length} ${this.activities.length === 1 ? 'update' : 'updates'}`;
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

    return String(value).replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private formatActivityValue(key: string, value: unknown): string {
    if (['amount', 'principal_amount'].includes(key.toLowerCase()) && typeof value === 'number') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }
    return this.formatMetadataValue(value);
  }
}
