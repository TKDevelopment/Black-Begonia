import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ToastService } from '../../../core/services/toast.service';
import { WorkshopCatalogRepositoryService } from '../../../core/supabase/repositories/workshop-catalog-repository.service';
import {
  workshopOccurrenceFixture,
  workshopSeriesFixture,
} from '../../../core/testing/workshop-testing';
import { WorkshopsComponent } from './workshops.component';

describe('WorkshopsComponent', () => {
  let component: WorkshopsComponent;
  let fixture: ComponentFixture<WorkshopsComponent>;
  let repository: jasmine.SpyObj<WorkshopCatalogRepositoryService>;
  let router: jasmine.SpyObj<Router>;
  let toast: jasmine.SpyObj<ToastService>;

  beforeEach(async () => {
    repository = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'WorkshopCatalogRepositoryService',
      ['listOccurrences', 'listSeries', 'publishOccurrence', 'archiveOccurrence', 'deleteOccurrence'],
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    toast = jasmine.createSpyObj<ToastService>('ToastService', ['showToast']);
    repository.listOccurrences.and.resolveTo([workshopOccurrenceFixture()]);
    repository.listSeries.and.resolveTo([]);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [WorkshopsComponent],
      providers: [
        { provide: WorkshopCatalogRepositoryService, useValue: repository },
        { provide: Router, useValue: router },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkshopsComponent);
    component = fixture.componentInstance;
  });

  it('loads occurrences and supports lifecycle filtering', async () => {
    await component.load();
    expect(component.loading()).toBeFalse();
    expect(component.occurrences().length).toBe(1);

    component.statusFilter.set('draft');
    expect(component.filteredConcepts()).toEqual([]);
  });

  it('groups every occurrence of a concept into one chronologically ordered card', async () => {
    const later = workshopOccurrenceFixture({
      workshop_occurrence_id: '10000000-0000-4000-8000-000000000099',
      local_start: '2026-10-17T13:00:00',
      start_at: '2026-10-17T17:00:00.000Z',
    });
    const earlier = workshopOccurrenceFixture();
    const anotherConcept = workshopOccurrenceFixture({
      workshop_occurrence_id: '10000000-0000-4000-8000-000000000098',
      workshop_definition_id: '10000000-0000-4000-8000-000000000097',
      title_snapshot: 'Pumpkins & Pours',
      local_start: '2026-09-19T13:00:00',
      start_at: '2026-09-19T17:00:00.000Z',
    });
    repository.listOccurrences.and.resolveTo([later, anotherConcept, earlier]);

    await component.load();

    expect(component.filteredConcepts().length).toBe(2);
    expect(component.filteredConcepts()[0].title).toBe('Summer Garden Centerpiece');
    expect(component.filteredConcepts()[0].occurrences.map(
      (occurrence) => occurrence.workshop_occurrence_id,
    )).toEqual([earlier.workshop_occurrence_id, later.workshop_occurrence_id]);
  });

  it('shows safe empty and error states', async () => {
    spyOn(console, 'error');
    repository.listOccurrences.and.resolveTo([]);
    await component.load();
    expect(component.occurrences()).toEqual([]);

    repository.listOccurrences.and.rejectWith(new Error('offline'));
    await component.load();
    expect(component.error()).toContain('unable');
  });

  it('routes to create, edit, and the current public occurrence destination', () => {
    const occurrence = workshopOccurrenceFixture();
    component.createWorkshop();
    component.editWorkshop(occurrence);
    component.previewWorkshop(occurrence);

    expect(router.navigate).toHaveBeenCalledWith(['/admin/workshops/new']);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/workshops', occurrence.workshop_occurrence_id, 'edit']);
    expect(router.navigate).toHaveBeenCalledWith([
      '/workshops', 'summer-garden-centerpiece', '2026-08-15',
    ]);
  });

  it('renders compact workshop rows without promotional or Stripe catalog copy', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('.workshop-row') as HTMLElement;
    expect(row.classList).toContain('p-4');
    expect(row.textContent).not.toContain('Design a garden-inspired centerpiece with us.');
    expect(row.textContent).not.toContain('Stripe enabled');
    expect(fixture.nativeElement.textContent).not.toContain(
      'Create, publish, and maintain workshop occurrences without changing the CRM calendar.',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Privacy and retention');
  });

  it('renders one concept card with a row for each occurrence date', async () => {
    repository.listOccurrences.and.resolveTo([
      workshopOccurrenceFixture(),
      workshopOccurrenceFixture({
        workshop_occurrence_id: '10000000-0000-4000-8000-000000000099',
        local_start: '2026-10-17T13:00:00',
        start_at: '2026-10-17T17:00:00.000Z',
      }),
    ]);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('.workshop-row').length).toBe(1);
    expect(fixture.nativeElement.querySelectorAll('.concept-occurrence-row').length).toBe(2);
  });

  it('publishes drafts and reports catalog validation errors', async () => {
    const draft = workshopOccurrenceFixture({ status: 'draft', published_at: null });
    repository.publishOccurrence.and.resolveTo({ ...draft, status: 'published_open' });
    await component.publish(draft);
    expect(repository.publishOccurrence).toHaveBeenCalled();
    expect(toast.showToast).toHaveBeenCalledWith('Workshop published.', 'success');

    repository.publishOccurrence.and.rejectWith({ message: 'effective hero image is required' });
    await component.publish(draft);
    expect(component.actionError()).toContain('effective hero');
  });

  it('deletes drafts but directs historical records to archive', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const draft = workshopOccurrenceFixture({ status: 'draft', published_at: null });
    const completed = workshopOccurrenceFixture({ status: 'completed' });
    repository.deleteOccurrence.and.resolveTo();
    repository.archiveOccurrence.and.resolveTo({ ...completed, status: 'archived' });

    await component.remove(draft);
    await component.remove(completed);

    expect(repository.deleteOccurrence).toHaveBeenCalledWith(
      draft.workshop_occurrence_id, jasmine.any(String),
    );
    expect(repository.archiveOccurrence).toHaveBeenCalledWith(
      completed.workshop_occurrence_id, jasmine.any(String),
    );
  });

  it('presents series relationships and per-occurrence exceptions', () => {
    const series = workshopSeriesFixture();
    const occurrence = workshopOccurrenceFixture({
      workshop_series_id: series.workshop_series_id,
      venue_name: 'Garden Annex',
      price_minor: 9500,
    });
    component.series.set([series]);

    expect(component.seriesFor(occurrence)).toBe(series);
    expect(component.seriesOverrideLabels(occurrence)).toEqual([
      'Venue exception',
      'Price exception',
    ]);
  });
});
