import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';

import { WorkshopMedia } from '../../../../core/models/workshop';
import { ToastService } from '../../../../core/services/toast.service';
import { WorkshopCatalogRepositoryService } from '../../../../core/supabase/repositories/workshop-catalog-repository.service';
import { WorkshopMediaService } from '../../../../core/supabase/services/workshop-media.service';
import {
  workshopDefinitionFixture,
  workshopOccurrenceFixture,
  workshopSeriesFixture,
} from '../../../../core/testing/workshop-testing';
import { WorkshopEditorComponent } from './workshop-editor.component';

describe('WorkshopEditorComponent', () => {
  let component: WorkshopEditorComponent;
  let fixture: ComponentFixture<WorkshopEditorComponent>;
  let repository: jasmine.SpyObj<WorkshopCatalogRepositoryService>;
  let mediaService: jasmine.SpyObj<WorkshopMediaService>;

  beforeEach(async () => {
    repository = jasmine.createSpyObj<WorkshopCatalogRepositoryService>(
      'WorkshopCatalogRepositoryService',
      [
        'listDefinitions', 'listSeries', 'listOccurrences', 'getOccurrence',
        'createDefinition', 'retireDefinition', 'createSeries', 'generateSeries',
        'previewSeriesUpdate', 'applySeriesUpdate', 'saveOccurrence',
        'publishOccurrence', 'listMedia', 'syncStripeCatalog',
      ],
    );
    const definition = workshopDefinitionFixture();
    repository.listDefinitions.and.resolveTo([definition]);
    repository.listSeries.and.resolveTo([]);
    repository.listOccurrences.and.resolveTo([]);
    repository.getOccurrence.and.resolveTo(workshopOccurrenceFixture({ status: 'draft' }));
    repository.listMedia.and.resolveTo([]);
    repository.createDefinition.and.resolveTo(definition);
    repository.saveOccurrence.and.resolveTo(workshopOccurrenceFixture({ status: 'draft' }));
    repository.syncStripeCatalog.and.resolveTo({
      productId: 'prod_workshop',
      priceId: 'price_workshop',
      priceVersionId: '10000000-0000-4000-8000-000000000088',
      reused: true,
    });
    mediaService = jasmine.createSpyObj<WorkshopMediaService>(
      'WorkshopMediaService',
      ['validateImage', 'upload', 'reorder', 'remove'],
    );
    mediaService.validateImage.and.returnValue([]);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [WorkshopEditorComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([['occurrenceId', 'new']])) },
        },
        { provide: Router, useValue: router },
        { provide: WorkshopCatalogRepositoryService, useValue: repository },
        { provide: WorkshopMediaService, useValue: mediaService },
        { provide: ToastService, useValue: jasmine.createSpyObj('ToastService', ['showToast']) },
      ],
    }).overrideComponent(WorkshopEditorComponent, { set: { template: '' } }).compileComponents();

    fixture = TestBed.createComponent(WorkshopEditorComponent);
    component = fixture.componentInstance;
  });

  it('requires content, venue, schedule, capacity, price, and terms', () => {
    component.form.patchValue({ title: '', venueName: '', terms: '', capacity: 0 });
    expect(component.form.valid).toBeFalse();
    expect(component.validationSummary()).toContain('title');
  });

  it('prefills an editable workshop terms template for a new workshop', () => {
    const terms = component.form.controls.terms.value;

    expect(terms).toContain('Customer cancellations, transfers, and no-shows');
    expect(terms).toContain('Workshop changes or cancellation');
    expect(terms).toContain('Arrival, participation, and safety');
    expect(terms).toContain('accessibility needs');
    expect(component.form.controls.terms.enabled).toBeTrue();
  });

  it('stages a non-reusable concept owner and uploads the first image from a new workshop', async () => {
    const definition = workshopDefinitionFixture({ is_reusable: false });
    const uploaded: WorkshopMedia = {
      workshop_media_id: '10000000-0000-4000-8000-000000000077',
      workshop_definition_id: definition.workshop_definition_id,
      workshop_occurrence_id: null,
      media_role: 'hero',
      storage_path: `definitions/${definition.workshop_definition_id}/hero-test.webp`,
      public_url: 'https://example.com/hero-test.webp',
      alt_text: 'A completed seasonal centerpiece',
      display_order: 0,
      is_public: true,
      width: 1200,
      height: 800,
      byte_size: 1024,
      mime_type: 'image/webp',
      created_by: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    };
    repository.createDefinition.and.resolveTo(definition);
    mediaService.upload.and.resolveTo(uploaded);
    component.form.patchValue(component.validExample());
    component.form.controls.definitionId.setValue('');
    component.mediaRole.set('hero');
    component.pendingMedia.set([{
      file: new File(['image'], 'hero-test.webp', { type: 'image/webp' }),
      altText: uploaded.alt_text,
    }]);
    spyOn(component as any, 'readImageDimensions').and.resolveTo({ width: 1200, height: 800 });

    await component.uploadMedia();

    expect(repository.createDefinition).toHaveBeenCalled();
    expect(mediaService.upload).toHaveBeenCalledWith(jasmine.objectContaining({
      owner: { definitionId: definition.workshop_definition_id },
      role: 'hero',
      altText: uploaded.alt_text,
    }));
    expect(component.form.controls.definitionId.value).toBe(definition.workshop_definition_id);
    expect(component.media()).toEqual([uploaded]);
    expect(component.selectedDefinition()?.is_reusable).toBeFalse();
  });

  it('uploads every selected gallery image with its own alternative text', async () => {
    const definition = workshopDefinitionFixture();
    const files = [
      new File(['one'], 'arrangement-one.webp', { type: 'image/webp' }),
      new File(['two'], 'arrangement-two.webp', { type: 'image/webp' }),
    ];
    component.form.controls.definitionId.setValue(definition.workshop_definition_id);
    component.definitions.set([definition]);
    component.mediaRole.set('gallery');
    component.pendingMedia.set([
      { file: files[0], altText: 'A guest shaping the first arrangement' },
      { file: files[1], altText: 'The completed second arrangement' },
    ]);
    mediaService.upload.and.callFake(async (input) => ({
      workshop_media_id: `10000000-0000-4000-8000-0000000000${input.displayOrder + 10}`,
      workshop_definition_id: definition.workshop_definition_id,
      workshop_occurrence_id: null,
      media_role: input.role,
      storage_path: `definitions/${definition.workshop_definition_id}/${input.file.name}`,
      public_url: `https://example.com/${input.file.name}`,
      alt_text: input.altText,
      display_order: input.displayOrder,
      is_public: true,
      width: 1200,
      height: 800,
      byte_size: input.file.size,
      mime_type: input.file.type,
      created_by: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    }));
    spyOn(component as any, 'readImageDimensions').and.resolveTo({ width: 1200, height: 800 });

    await component.uploadMedia();

    expect(mediaService.upload).toHaveBeenCalledTimes(2);
    expect(mediaService.upload.calls.allArgs().map(([input]) => input.altText)).toEqual([
      'A guest shaping the first arrangement',
      'The completed second arrangement',
    ]);
    expect(component.media().length).toBe(2);
    expect(component.pendingMedia()).toEqual([]);
  });

  it('keeps a pending image row stable while its alternative text is typed', () => {
    const file = new File(['image'], 'stable-row.webp', { type: 'image/webp' });
    component.pendingMedia.set([{ file, altText: '' }]);
    const initialTrackValue = component.trackPendingMedia(0, component.pendingMedia()[0]);

    component.updatePendingMediaAlt(0, 'A');
    component.updatePendingMediaAlt(0, 'An arrangement');

    expect(component.trackPendingMedia(0, component.pendingMedia()[0])).toBe(initialTrackValue);
    expect(component.pendingMedia()[0].altText).toBe('An arrangement');
  });

  it('formats the customer preview date and local time on separate display values', () => {
    component.occurrenceSchedules.at(0).patchValue({
      date: '2027-03-27',
      localStartTime: '10:30',
      localEndTime: '11:30',
    });

    expect(component.previewDateLabel()).toBe('27 March 2027');
    expect(component.previewTimeLabel()).toBe('@ 10:30 AM - 11:30 AM');
  });

  it('exposes uploaded hero and gallery media to the customer preview', () => {
    const definitionId = workshopDefinitionFixture().workshop_definition_id;
    const makeMedia = (role: 'hero' | 'gallery', index: number): WorkshopMedia => ({
      workshop_media_id: `10000000-0000-4000-8000-0000000000${index + 20}`,
      workshop_definition_id: definitionId,
      workshop_occurrence_id: null,
      media_role: role,
      storage_path: `definitions/${definitionId}/${role}-${index}.webp`,
      public_url: `https://example.com/${role}-${index}.webp`,
      alt_text: `${role} image ${index}`,
      display_order: index,
      is_public: true,
      width: 1200,
      height: 800,
      byte_size: 1024,
      mime_type: 'image/webp',
      created_by: null,
      created_at: '2026-08-01T00:00:00Z',
      updated_at: '2026-08-01T00:00:00Z',
    });
    const hero = makeMedia('hero', 0);
    const gallery = [makeMedia('gallery', 1), makeMedia('gallery', 2)];
    component.media.set([hero, ...gallery]);

    expect(component.previewHeroMedia()).toBe(hero);
    expect(component.previewGalleryMedia()).toEqual(gallery);
  });

  it('rejects invalid booking limits and chronological schedule', () => {
    component.form.patchValue({
      capacity: 4,
      perBookingLimit: 5,
      occurrences: [{
        date: '2026-08-15',
        localStartTime: '15:00',
        localEndTime: '14:00',
        registrationStartDate: '2026-08-14',
        registrationCloseDate: '2026-08-16',
      }],
    });
    expect(component.scheduleErrors().some((message) => message.includes('end'))).toBeTrue();
    expect(component.scheduleErrors().some((message) => message.includes('booking limit'))).toBeTrue();
  });

  it('creates a preview without persisting and warns on published material changes', () => {
    component.currentOccurrence.set(workshopOccurrenceFixture());
    component.form.patchValue({ priceMajor: 95 });
    component.openPreview();

    expect(component.previewOpen()).toBeTrue();
    expect(component.materialChangeWarning()).toContain('published');
    expect(repository.saveOccurrence).not.toHaveBeenCalled();
  });

  it('exposes the selected definition catalog state for publication readiness', () => {
    const definition = workshopDefinitionFixture({ stripe_catalog_state: 'failed' });
    component.definitions.set([definition]);
    component.form.controls.definitionId.setValue(definition.workshop_definition_id);

    expect(component.selectedDefinition()?.stripe_catalog_state).toBe('failed');
    expect(component.stripeCatalogMessage()).toContain('needs attention');
  });

  it('explains that an unsynced Stripe catalog is configured during save', () => {
    const definition = workshopDefinitionFixture({ stripe_catalog_state: 'not_configured' });
    component.definitions.set([definition]);
    component.form.controls.definitionId.setValue(definition.workshop_definition_id);

    expect(component.stripeCatalogMessage()).toBe(
      'Stripe Checkout will be configured when this workshop is saved.',
    );
  });

  it('auto-generates the slug and resolves the New York timezone offset', async () => {
    component.form.patchValue(component.validExample());
    await component.save(false);

    expect(repository.saveOccurrence).toHaveBeenCalledWith(
      jasmine.objectContaining({
        priceMinor: 8500,
        slug: 'summer-garden-centerpiece-2026-08-15',
        timezone: 'America/New_York',
        utcOffsetMinutes: -240,
      }),
      jasmine.any(String),
    );
  });

  it('always enables checkout, direct Venmo, waitlist, and carousel promotion', async () => {
    component.form.patchValue(component.validExample());

    await component.save(false);

    expect(repository.syncStripeCatalog).toHaveBeenCalled();
    expect(repository.saveOccurrence).toHaveBeenCalledWith(
      jasmine.objectContaining({
        stripeEnabled: true,
        venmoEnabled: true,
        waitlistEnabled: true,
        isFeatured: true,
      }),
      jasmine.any(String),
    );
    expect(component.form.contains('stripeEnabled')).toBeFalse();
    expect(component.form.contains('venmoEnabled')).toBeFalse();
    expect(component.form.contains('waitlistEnabled')).toBeFalse();
    expect(component.form.contains('isFeatured')).toBeFalse();
  });

  it('publishes only after the saved draft succeeds', async () => {
    component.form.patchValue(component.validExample());
    await component.save(true);

    expect(repository.saveOccurrence).toHaveBeenCalledBefore(repository.publishOccurrence);
  });

  it('reuses a selected concept without creating a duplicate definition', async () => {
    const definition = workshopDefinitionFixture({ is_reusable: true });
    component.definitions.set([definition]);
    component.form.patchValue({
      ...component.validExample(),
      definitionId: definition.workshop_definition_id,
    });

    await component.save(true);

    expect(repository.createDefinition).not.toHaveBeenCalled();
    expect(repository.saveOccurrence).toHaveBeenCalledWith(
      jasmine.objectContaining({ workshopDefinitionId: definition.workshop_definition_id }),
      jasmine.any(String),
    );
  });

  it('retires a reusable concept option without deleting its workshop content', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const definition = workshopDefinitionFixture({ is_reusable: true });
    repository.retireDefinition.and.resolveTo({ ...definition, is_reusable: false });
    component.definitions.set([definition]);
    component.form.patchValue({
      definitionId: definition.workshop_definition_id,
      title: definition.title,
    });

    await component.removeSelectedConcept();

    expect(repository.retireDefinition).toHaveBeenCalledWith(definition.workshop_definition_id);
    expect(component.form.controls.definitionId.value).toBe(definition.workshop_definition_id);
    expect(component.form.controls.title.value).toBe(definition.title);
    expect(component.conceptOptions()).toEqual([{ ...definition, is_reusable: false }]);
  });

  it('adds and removes independently editable occurrence schedule rows', () => {
    component.addOccurrence();
    component.occurrenceSchedules.at(1).patchValue({ date: '2026-11-14' });

    expect(component.occurrenceSchedules.length).toBe(2);
    expect(component.seriesMode()).toBeTrue();

    component.removeOccurrence(0);
    expect(component.occurrenceSchedules.length).toBe(1);
    expect(component.seriesMode()).toBeFalse();
    expect(component.occurrenceSchedules.at(0).controls.date.value).toBe('2026-11-14');
  });

  it('generates independently identified occurrence drafts from the date preview', async () => {
    const series = workshopSeriesFixture();
    const generated = [
      workshopOccurrenceFixture({ workshop_series_id: series.workshop_series_id }),
      workshopOccurrenceFixture({
        workshop_occurrence_id: '10000000-0000-4000-8000-000000000099',
        workshop_series_id: series.workshop_series_id,
      }),
    ];
    repository.createSeries.and.resolveTo(series);
    repository.generateSeries.and.resolveTo(generated);
    component.form.patchValue(component.validExample());
    component.addOccurrence();
    component.occurrenceSchedules.at(1).patchValue({
      date: '2026-11-14',
      localStartTime: '13:00',
      localEndTime: '15:00',
      registrationStartDate: '2026-09-01',
      registrationCloseDate: '2026-11-13',
    });
    component.seriesLabel.set('Fall centerpiece series');

    await component.generateSeries(false);

    const drafts = repository.generateSeries.calls.mostRecent().args[1];
    expect(drafts.length).toBe(2);
    expect(drafts[0].workshopOccurrenceId).toBeUndefined();
    expect(drafts[0].slug).not.toBe(drafts[1].slug);
    expect(drafts.map((draft) => draft.utcOffsetMinutes)).toEqual([-240, -300]);
  });

  it('shows inquiry-style validation tooltips after an invalid publish attempt', async () => {
    component.form.controls.title.setValue('');

    await component.save(true);

    expect(component.invalidTooltips['title']).toBe('visible');
    expect(repository.saveOccurrence).not.toHaveBeenCalled();
  });

  it('previews selected series updates and exposes occurrence overrides', async () => {
    const series = workshopSeriesFixture();
    const current = workshopOccurrenceFixture({
      workshop_series_id: series.workshop_series_id,
      price_minor: 9500,
    });
    repository.previewSeriesUpdate.and.resolveTo({
      occurrenceIds: [current.workshop_occurrence_id],
      bookedOccurrenceIds: [current.workshop_occurrence_id],
    });
    component.series.set([series]);
    component.currentOccurrence.set(current);
    component.seriesOccurrences.set([current]);
    component.seriesScope.set('selected');
    component.selectedSeriesOccurrenceIds.set([current.workshop_occurrence_id]);

    await component.previewBulkUpdate();

    expect(repository.previewSeriesUpdate).toHaveBeenCalledWith(
      series.workshop_series_id,
      [current.workshop_occurrence_id],
      jasmine.objectContaining({ scope: 'selected' }),
    );
    expect(component.seriesUpdatePreview()?.bookedOccurrenceIds).toEqual([
      current.workshop_occurrence_id,
    ]);
    expect(component.overrideLabels(current)).toContain('Price override');
  });

  it('requires explicit confirmation before applying changes to booked dates', async () => {
    spyOn(window, 'confirm').and.returnValue(true);
    const series = workshopSeriesFixture();
    const current = workshopOccurrenceFixture({
      workshop_series_id: series.workshop_series_id,
    });
    component.series.set([series]);
    component.currentOccurrence.set(current);
    component.seriesUpdatePreview.set({
      occurrenceIds: [current.workshop_occurrence_id],
      bookedOccurrenceIds: [current.workshop_occurrence_id],
    });
    repository.applySeriesUpdate.and.resolveTo({
      occurrenceIds: [current.workshop_occurrence_id],
      bookedOccurrenceIds: [current.workshop_occurrence_id],
      occurrences: [current],
    });

    await component.applyBulkUpdate();

    expect(window.confirm).toHaveBeenCalled();
    expect(repository.applySeriesUpdate).toHaveBeenCalledWith(
      series.workshop_series_id,
      [current.workshop_occurrence_id],
      jasmine.objectContaining({
        confirmedBookedOccurrenceIds: [current.workshop_occurrence_id],
      }),
      jasmine.any(String),
    );
  });
});
