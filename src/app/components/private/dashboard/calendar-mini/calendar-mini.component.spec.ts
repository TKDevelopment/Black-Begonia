import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarMiniComponent } from './calendar-mini.component';

describe('CalendarMiniComponent', () => {
  let fixture: ComponentFixture<CalendarMiniComponent>;
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [CalendarMiniComponent], providers: [provideRouter([])] }).compileComponents();
    fixture = TestBed.createComponent(CalendarMiniComponent);
    fixture.componentInstance.month = new Date(2026, 9, 1);
  });

  it('shows crowded days as count and distinct type indicators without exposing payment amounts', () => {
    fixture.componentInstance.items = Array.from({ length: 5 }, (_, index) => ({
      id: `installment:${index}`, sourceType: 'installment' as const, sourceId: `${index}`,
      title: 'Ava & Sam - Deposit', start: '2026-10-17', end: '2026-10-18',
      allDay: true, localDate: '2026-10-17', status: 'due', isInactive: false,
      colorType: 'installment' as const, destination: '/admin/projects/1',
    }));
    fixture.detectChanges();
    const day = fixture.nativeElement.querySelector('[aria-label="2026-10-17, 5 items"]');
    expect(day).toBeTruthy();
    expect(day.querySelectorAll('.dots i').length).toBe(1);
    expect(fixture.nativeElement.textContent).not.toContain('$');
  });

  it('links to the corresponding full-calendar month', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.mini-header a').getAttribute('href'))
      .toContain('/admin/calendar?month=2026-10');
  });

  it('keeps the compact header and day grid able to fit narrow containers', () => {
    fixture.detectChanges();
    const header = fixture.nativeElement.querySelector('.mini-header') as HTMLElement;
    const day = fixture.nativeElement.querySelector('.mini-day') as HTMLElement;
    expect(getComputedStyle(header).flexWrap).toBe('wrap');
    expect(getComputedStyle(day).minWidth).toBe('0px');
  });

  it('shows day indicators for all five CRM kinds without displaying client details', () => {
    const kinds = [
      ['lead_event', 'lead'], ['project_event', 'project'],
      ['consultation', 'consultation'], ['installment', 'installment'],
      ['workshop', 'workshop'],
    ] as const;
    fixture.componentInstance.items = kinds.map(([sourceType, colorType], index) => {
      const day = `2026-10-0${index + 1}`;
      return {
        id: `${sourceType}:${index}`, sourceType, sourceId: `${index}`,
        title: 'Private client detail', start: day,
        end: `2026-10-0${index + 2}`, allDay: true, localDate: day,
        status: 'new', isInactive: false, colorType, destination: null,
      };
    });
    fixture.detectChanges();
    const expectedColors = [
      'rgb(253, 230, 138)', 'rgb(147, 197, 253)', 'rgb(216, 180, 254)',
      'rgb(134, 239, 172)', 'rgb(253, 164, 175)',
    ];
    kinds.forEach((_, index) => {
      const day = fixture.nativeElement.querySelector(
        `[aria-label="2026-10-0${index + 1}, 1 items"]`);
      expect(getComputedStyle(day.querySelector('.dots i')).backgroundColor)
        .toBe(expectedColors[index]);
    });
    expect(fixture.nativeElement.textContent).not.toContain('Private client detail');
  });

  it('counts an all-day event on each day before its exclusive end', () => {
    fixture.componentInstance.items = [{
      id: 'workshop:1', sourceType: 'workshop', sourceId: '1',
      title: 'Autumn Arrangements - Workshop', start: '2026-10-17', end: '2026-10-20',
      allDay: true, localDate: '2026-10-17', status: 'published_open',
      isInactive: false, colorType: 'workshop', destination: '/admin/workshops/1',
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-17, 1 items"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-18, 1 items"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-19, 1 items"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-20, no items"]')).toBeTruthy();
  });

  it('counts a timed workshop across midnight in its saved timezone', () => {
    fixture.componentInstance.items = [{
      id: 'workshop:2', sourceType: 'workshop', sourceId: '2',
      title: 'Autumn Arrangements - Workshop',
      start: '2026-10-18T03:30:00Z', end: '2026-10-18T05:30:00Z',
      allDay: false, localDate: '2026-10-17', timezone: 'America/Chicago',
      status: 'published_open', isInactive: false,
      colorType: 'workshop', destination: '/admin/workshops/2',
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-17, 1 items"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-18, 1 items"]')).toBeTruthy();
  });

  it('shows a long Microsoft event that began before the visible grid', () => {
    fixture.componentInstance.items = [{
      id: 'microsoft:long', sourceType: 'microsoft', sourceId: null,
      title: 'Long event', start: '2026-08-01', end: '2026-10-03',
      allDay: true, localDate: '2026-08-01', status: null,
      isInactive: false, colorType: 'microsoft', destination: null,
    }];
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-01, 1 items"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[aria-label="2026-10-02, 1 items"]')).toBeTruthy();
  });

  it('shows private Microsoft activity without exposing its type or count', () => {
    fixture.componentInstance.items = [
      ...[0, 1].map(index => ({
        id: `microsoft:private-${index}`, sourceType: 'microsoft' as const, sourceId: null,
        title: 'Private event', start: '2026-10-17', end: '2026-10-18',
        allDay: true, localDate: '2026-10-17', status: null, isInactive: false,
        colorType: 'microsoft' as const, destination: null, isPrivate: true,
      })),
      { id: 'microsoft:private-3', sourceType: 'microsoft' as const, sourceId: null,
        title: 'Private event', start: '2026-10-18', end: '2026-10-19',
        allDay: true, localDate: '2026-10-18', status: null, isInactive: false,
        colorType: 'microsoft' as const, destination: null, isPrivate: true },
      { id: 'installment:public', sourceType: 'installment' as const, sourceId: '1',
        title: 'Ava & Sam - Deposit', start: '2026-10-18', end: '2026-10-19',
        allDay: true, localDate: '2026-10-18', status: 'due', isInactive: false,
        colorType: 'installment' as const, destination: null },
    ];
    fixture.detectChanges();
    const privateDay = fixture.nativeElement.querySelector('[aria-label="2026-10-17, activity"]');
    const mixedDay = fixture.nativeElement.querySelector('[aria-label="2026-10-18, 1 items"]');
    expect(privateDay.querySelectorAll('.dots i').length).toBe(1);
    expect(privateDay.querySelector('.private-activity')).toBeTruthy();
    expect(mixedDay.querySelectorAll('.dots i').length).toBe(1);
    expect(mixedDay.querySelector('.private-activity')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Private event');
  });

  it('renders a representative 200-item month within three seconds', () => {
    const kinds = ['lead', 'project', 'consultation', 'installment', 'workshop'] as const;
    fixture.componentInstance.items = Array.from({ length: 200 }, (_, index) => {
      const day = String(1 + index % 28).padStart(2, '0');
      return {
        id: `item:${index}`, sourceType: 'lead_event' as const, sourceId: `${index}`,
        title: `Calendar item ${index}`, start: `2026-10-${day}`,
        end: `2026-10-${String(2 + index % 28).padStart(2, '0')}`,
        allDay: true, localDate: `2026-10-${day}`, status: 'new',
        isInactive: false, colorType: kinds[index % kinds.length], destination: null,
      };
    });
    const started = performance.now();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.mini-day').length).toBeGreaterThan(28);
    expect(performance.now() - started).toBeLessThan(3000);
  });
});
