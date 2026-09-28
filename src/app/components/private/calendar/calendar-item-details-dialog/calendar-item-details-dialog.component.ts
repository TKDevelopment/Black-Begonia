import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { DialogRef, DIALOG_DATA } from '@angular/cdk/dialog';
import { RouterLink } from '@angular/router';
import { CrmCalendarItemDetails } from '../../../../core/models/crm-calendar';
import { parseDateOnlyForDisplay } from '../../../../core/utils/date-only';

@Component({
  selector: 'app-calendar-item-details-dialog',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar-item-details-dialog.component.html',
  styleUrl: './calendar-item-details-dialog.component.scss',
})
export class CalendarItemDetailsDialogComponent {
  constructor(
    @Inject(DIALOG_DATA) readonly item: CrmCalendarItemDetails,
    readonly dialogRef: DialogRef,
  ) {}

  get displayTitle(): string {
    if (this.item.sourceType !== 'lead_event' && this.item.sourceType !== 'project_event') {
      return this.item.title;
    }
    const separator = this.item.title.indexOf(' - ');
    return separator < 0 ? this.item.title : this.item.title.slice(0, separator);
  }

  get displayDate(): Date | null { return parseDateOnlyForDisplay(this.item.localDate); }

  get displayTime(): string {
    if (this.item.allDay) return 'All day';
    const format = (value: string): string => new Intl.DateTimeFormat('en-US', {
      timeZone: this.item.timezone || 'America/New_York',
      hour: 'numeric', minute: '2-digit',
    }).format(new Date(value));
    return `${format(this.item.start)} – ${format(this.item.end)}`;
  }

  get safeOutlookUrl(): string | null {
    const raw = this.item.outlookWebUrl;
    if (!raw) return null;
    try {
      const url = new URL(raw);
      return url.protocol === 'https:' &&
        (url.hostname === 'outlook.office.com' || url.hostname === 'outlook.office365.com')
        ? url.toString() : null;
    } catch { return null; }
  }
}
