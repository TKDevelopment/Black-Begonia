import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CrmCalendarSyncHealth } from '../../../../core/models/crm-calendar';
import {
  CrmM365CalendarAdminService, CrmM365CalendarSummary, CrmM365Conflict,
} from '../../../../core/supabase/services/crm-m365-calendar-admin.service';

@Component({
  selector: 'app-calendar-connection-panel', standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './calendar-connection-panel.component.html',
  styleUrl: './calendar-connection-panel.component.scss',
})
export class CalendarConnectionPanelComponent {
  @Input() health: CrmCalendarSyncHealth | null = null;
  @Input() isAdmin = false;
  @Output() changed = new EventEmitter<void>();
  private readonly admin = inject(CrmM365CalendarAdminService);
  readonly calendars = signal<CrmM365CalendarSummary[]>([]);
  readonly conflicts = signal<CrmM365Conflict[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly message = signal<string | null>(null);
  selectedCalendarId = '';

  async loadCalendars(): Promise<void> {
    if (!this.isAdmin) return;
    await this.perform(async () => {
      const rows = await this.admin.listCalendars();
      this.calendars.set(rows);
      this.selectedCalendarId = rows[0]?.id ?? '';
      this.message.set(rows.length ? null : 'No calendars were found in the business mailbox.');
    });
  }
  async connect(): Promise<void> {
    if (!this.isAdmin || !this.selectedCalendarId) return;
    await this.perform(async () => {
      await this.admin.connect(this.selectedCalendarId);
      this.message.set('Business calendar connected. Initial synchronization is queued.');
      this.changed.emit();
    });
  }
  async refresh(): Promise<void> {
    if (!this.isAdmin) return;
    await this.perform(async () => {
      await this.admin.refresh();
      this.message.set('A synchronization run is queued.');
      this.changed.emit();
    });
  }
  async disconnect(): Promise<void> {
    if (!this.isAdmin) return;
    await this.perform(async () => {
      await this.admin.disconnect();
      this.message.set('Disconnected. Existing Microsoft mirrors remain in Outlook.');
      this.changed.emit();
    });
  }
  async loadConflicts(): Promise<void> {
    if (!this.isAdmin) return;
    await this.perform(async () => this.conflicts.set(await this.admin.listConflicts()));
  }
  async restore(conflictId: string): Promise<void> {
    if (!this.isAdmin) return;
    await this.perform(async () => {
      await this.admin.restoreConflict(conflictId);
      this.message.set('Restoration queued. The CRM record remains unchanged.');
      this.changed.emit();
      this.conflicts.set(await this.admin.listConflicts());
    });
  }

  private async perform(work: () => Promise<void>): Promise<void> {
    this.busy.set(true); this.error.set(null);
    try { await work(); }
    catch { this.error.set('The Microsoft calendar action could not be completed. Please try again.'); }
    finally { this.busy.set(false); }
  }
}
