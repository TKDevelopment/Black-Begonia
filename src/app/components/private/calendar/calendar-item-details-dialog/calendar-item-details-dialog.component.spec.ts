import { Dialog, DialogRef } from '@angular/cdk/dialog';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CrmCalendarItemDetails } from '../../../../core/models/crm-calendar';
import { CalendarItemDetailsDialogComponent } from './calendar-item-details-dialog.component';

describe('CalendarItemDetailsDialogComponent', () => {
  let dialog: Dialog;
  let reference: DialogRef<unknown, CalendarItemDetailsDialogComponent> | null;
  const item: CrmCalendarItemDetails = {
    id: 'installment:1', sourceType: 'installment', sourceId: '1',
    title: 'Ada & Bea - Deposit', start: '2026-10-09', end: '2026-10-10',
    allDay: true, localDate: '2026-10-09', status: 'partially_paid',
    isInactive: false, colorType: 'installment', destination: '/admin/projects/2',
    targetAmount: 120, creditedAmount: 20, outstandingAmount: 100,
    paymentKind: 'deposit', paidDate: null, paymentMethod: null,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CalendarItemDetailsDialogComponent], providers: [provideRouter([])],
    });
    dialog = TestBed.inject(Dialog);
    reference = null;
  });
  afterEach(() => reference?.close());

  it('shows current installment amounts and a source link', () => {
    reference = dialog.open(CalendarItemDetailsDialogComponent, { data: item });
    reference.componentRef?.changeDetectorRef.detectChanges();
    const panel = document.querySelector('.calendar-detail') as HTMLElement;
    expect(panel.textContent).toContain('$120.00');
    expect(panel.textContent).toContain('$20.00');
    expect(panel.textContent).toContain('$100.00');
    expect(panel.querySelector('a')?.getAttribute('href')).toBe('/admin/projects/2#payments-installments');
  });

  it('keeps the outer dialog panel transparent behind the rounded card in both themes', () => {
    for (const dark of [false, true]) {
      reference = dialog.open(CalendarItemDetailsDialogComponent, {
        data: item,
        panelClass: dark ? ['crm-calendar-dialog-panel', 'crm-theme-dark'] : 'crm-calendar-dialog-panel',
      });
      reference.componentRef?.changeDetectorRef.detectChanges();
      const pane = document.querySelector('.cdk-overlay-pane.crm-calendar-dialog-panel') as HTMLElement;
      const card = pane.querySelector('.calendar-detail') as HTMLElement;
      expect(getComputedStyle(pane).backgroundColor).toBe('rgba(0, 0, 0, 0)');
      expect(getComputedStyle(card).backgroundColor).toBe(dark ? 'rgb(18, 23, 29)' : 'rgb(255, 255, 255)');
      reference.close();
    }
  });

  it('hides private Microsoft status and location while allowing a safe Outlook link', () => {
    reference = dialog.open(CalendarItemDetailsDialogComponent, { data: {
      ...item, id: 'microsoft:one', sourceType: 'microsoft', sourceId: null,
      title: 'Private event', isPrivate: true, status: null,
      venueName: 'Secret place', destination: null,
      outlookWebUrl: 'https://outlook.office.com/calendar/item/123',
    } });
    reference.componentRef?.changeDetectorRef.detectChanges();
    const panel = document.querySelector('.calendar-detail') as HTMLElement;
    expect(panel.textContent).toContain('Private event');
    expect(panel.textContent).not.toContain('Secret place');
    expect(panel.textContent).not.toContain('partially_paid');
    expect(panel.querySelector('a')?.getAttribute('href')).toBe('https://outlook.office.com/calendar/item/123');
  });

  it('closes with the visible button', () => {
    reference = dialog.open(CalendarItemDetailsDialogComponent, { data: item });
    reference.componentRef?.changeDetectorRef.detectChanges();
    const close = document.querySelector('.calendar-detail-close') as HTMLButtonElement;
    close.click();
    expect(document.querySelector('.calendar-detail')).toBeNull();
  });

  it('shows workshop schedule, venue, capacity, and status', () => {
    reference = dialog.open(CalendarItemDetailsDialogComponent, { data: {
      ...item, sourceType: 'workshop', sourceId: '3',
      title: 'Autumn Arrangements - Workshop', allDay: false,
      start: '2026-10-20T18:00:00Z', end: '2026-10-20T20:00:00Z',
      status: 'published_open', venueName: 'Studio', venueAddress: '23 Gilman Rd',
      timezone: 'America/New_York', capacity: 12, destination: '/admin/workshops/3',
    } });
    reference.componentRef?.changeDetectorRef.detectChanges();
    const panel = document.querySelector('.calendar-detail') as HTMLElement;
    expect(panel.textContent).toContain('Autumn Arrangements - Workshop');
    expect(panel.textContent).toContain('Studio');
    expect(panel.textContent).toContain('23 Gilman Rd');
    expect(panel.textContent).toContain('12');
    expect(panel.textContent).toContain('America/New_York');
  });

  it('shows lead, project, and consultation details with source links', () => {
    for (const sourceType of ['lead_event', 'project_event', 'consultation'] as const) {
      reference = dialog.open(CalendarItemDetailsDialogComponent, { data: {
        ...item, sourceType, colorType: sourceType === 'project_event' ? 'project' :
          sourceType === 'consultation' ? 'consultation' : 'lead',
        title: sourceType === 'consultation' ? 'Ada & Bea - Consultation' : 'Ada & Bea - Wedding',
        serviceType: 'wedding', guestCount: 85, venueName: 'Garden',
        venueAddress: '23 Gilman Rd', status: 'new', destination: '/admin/leads/1',
        allDay: sourceType !== 'consultation',
        start: sourceType === 'consultation' ? '2026-10-09T14:00:00Z' : '2026-10-09',
        end: sourceType === 'consultation' ? '2026-10-09T15:00:00Z' : '2026-10-10',
      } });
      reference.componentRef?.changeDetectorRef.detectChanges();
      const panel = document.querySelector('.calendar-detail') as HTMLElement;
      expect(panel.querySelector('#calendar-detail-title')?.textContent).toBe(
        sourceType === 'consultation' ? 'Ada & Bea - Consultation' : 'Ada & Bea');
      expect(panel.textContent).toContain('Ada & Bea');
      expect(panel.textContent).toContain('Wedding');
      expect(panel.textContent).toContain('85');
      expect(panel.textContent).toContain('Garden');
      expect(panel.querySelector('a')?.getAttribute('href')).toBe('/admin/leads/1');
      reference.close();
    }
  });

  it('closes on Escape and returns focus to the triggering control', fakeAsync(() => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();
    try {
      reference = dialog.open(CalendarItemDetailsDialogComponent, {
        data: item, autoFocus: 'first-tabbable', restoreFocus: true,
      });
      reference.componentRef?.changeDetectorRef.detectChanges();
      tick();
      const close = document.querySelector('.calendar-detail-close') as HTMLButtonElement;
      expect(document.activeElement).toBe(close);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true });
      Object.defineProperty(escape, 'keyCode', { get: () => 27 });
      close.dispatchEvent(escape);
      tick();
      expect(document.querySelector('.calendar-detail')).toBeNull();
      expect(document.activeElement).toBe(trigger);
    } finally {
      trigger.remove();
    }
  }));
});
