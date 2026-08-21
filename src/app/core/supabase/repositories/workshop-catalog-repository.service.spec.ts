import { TestBed } from '@angular/core/testing';

import {
  workshopDefinitionFixture,
  workshopOccurrenceFixture,
  workshopSeriesFixture,
} from '../../testing/workshop-testing';
import { SupabaseService } from '../clients/supabase.service';
import { WorkshopCatalogRepositoryService } from './workshop-catalog-repository.service';

describe('WorkshopCatalogRepositoryService', () => {
  let service: WorkshopCatalogRepositoryService;
  let supabase: jasmine.SpyObj<SupabaseService>;
  let client: {
    from: jasmine.Spy;
    rpc: jasmine.Spy;
    functions: { invoke: jasmine.Spy };
  };

  beforeEach(() => {
    client = {
      from: jasmine.createSpy('from'),
      rpc: jasmine.createSpy('rpc'),
      functions: { invoke: jasmine.createSpy('invoke') },
    };
    supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue(client as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopCatalogRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopCatalogRepositoryService);
  });

  it('maps definitions and occurrences from separate catalog queries', async () => {
    const definitions = workshopDefinitionFixture();
    const occurrences = workshopOccurrenceFixture();
    client.from.and.returnValues(
      selectOrderResult([definitions]),
      selectOrderResult([occurrences]),
    );

    await expectAsync(service.listDefinitions()).toBeResolvedTo([definitions]);
    await expectAsync(service.listOccurrences()).toBeResolvedTo([occurrences]);

    expect(client.from).toHaveBeenCalledWith('workshop_definitions');
    expect(client.from).toHaveBeenCalledWith('workshop_occurrences');
  });

  it('normalizes definition content before create and update', async () => {
    const definition = workshopDefinitionFixture();
    const createQuery = mutationResult(definition);
    const updateQuery = mutationResult(definition);
    client.from.and.returnValues(createQuery, updateQuery);

    await service.createDefinition({
      title: ' Garden Centerpiece ',
      theme: ' seasonal ',
      advertisingLine: ' Design with the season. ',
      description: ' A welcoming workshop. ',
      includedMaterials: ' Flowers and vessel. ',
      defaultTerms: ' Cancellation terms. ',
    });
    await service.updateDefinition(definition.workshop_definition_id, {
      advertisingLine: ' Updated line. ',
    });

    expect(createQuery.insert).toHaveBeenCalledWith(jasmine.objectContaining({
      title: 'Garden Centerpiece',
      theme: 'seasonal',
      default_currency: 'USD',
      is_reusable: false,
    }));
    expect(updateQuery.update).toHaveBeenCalledWith(jasmine.objectContaining({
      advertising_line: 'Updated line.',
    }));
  });

  it('retires a definition from the reusable concept chooser without deleting it', async () => {
    const definition = workshopDefinitionFixture({ is_reusable: false });
    const query = mutationResult(definition);
    client.from.and.returnValue(query);

    await expectAsync(service.retireDefinition(definition.workshop_definition_id))
      .toBeResolvedTo(definition);

    expect(query.update).toHaveBeenCalledWith({
      is_reusable: false,
      reusable_retired_at: jasmine.any(String),
    });
    expect(query.eq).toHaveBeenCalledWith(
      'workshop_definition_id', definition.workshop_definition_id,
    );
  });

  it('delegates replay-safe occurrence commands with command keys', async () => {
    const occurrence = workshopOccurrenceFixture();
    client.rpc.and.resolveTo({ data: occurrence, error: null });
    const draft = service.toDraft(occurrence);

    await service.saveOccurrence(draft, 'command-save');
    await service.publishOccurrence(occurrence.workshop_occurrence_id, 'command-publish');
    await service.archiveOccurrence(occurrence.workshop_occurrence_id, 'command-archive');

    expect(client.rpc).toHaveBeenCalledWith('save_workshop_occurrence', {
      p_draft: draft,
      p_command_key: 'command-save',
    });
    expect(client.rpc).toHaveBeenCalledWith('publish_workshop_occurrence', {
      p_workshop_occurrence_id: occurrence.workshop_occurrence_id,
      p_command_key: 'command-publish',
    });
  });

  it('delegates an atomic concept update for definition and occurrence snapshots', async () => {
    const occurrence = workshopOccurrenceFixture();
    client.rpc.and.resolveTo({ data: [occurrence], error: null });
    const patch = {
      title: 'Pumpkins & Pours',
      theme: 'autumn',
      advertisingLine: 'An autumn floral evening.',
      description: 'Design with pumpkins and flowers.',
      includedMaterials: 'Pumpkin, flowers, tools, and instruction.',
      defaultTerms: 'Updated cancellation terms.',
    };

    await expectAsync(service.updateConcept(
      occurrence.workshop_definition_id,
      patch,
      'command-concept-update',
    )).toBeResolvedTo([occurrence]);

    expect(client.rpc).toHaveBeenCalledWith('update_workshop_concept', {
      p_workshop_definition_id: occurrence.workshop_definition_id,
      p_patch: patch,
      p_command_key: 'command-concept-update',
    });
  });

  it('surfaces publication validation errors without rewriting them', async () => {
    const error = { code: '22023', message: 'effective hero image is required' };
    client.rpc.and.resolveTo({ data: null, error });

    await expectAsync(service.publishOccurrence('occurrence', 'command'))
      .toBeRejectedWith(error);
  });

  it('counts booked reservations before delegating guarded occurrence deletion', async () => {
    const occurrence = workshopOccurrenceFixture();
    const bookingQuery = countResult(2);
    client.from.and.returnValue(bookingQuery);
    client.rpc.and.resolveTo({ data: { deleted: true }, error: null });

    await expectAsync(service.countOccurrenceBookings(occurrence.workshop_occurrence_id))
      .toBeResolvedTo(2);
    await service.deleteOccurrence(occurrence.workshop_occurrence_id, 'command-delete');

    expect(client.from).toHaveBeenCalledWith('workshop_bookings');
    expect(bookingQuery.select).toHaveBeenCalledWith(
      'workshop_booking_id',
      { count: 'exact', head: true },
    );
    expect(bookingQuery.eq).toHaveBeenCalledWith(
      'workshop_occurrence_id', occurrence.workshop_occurrence_id,
    );
    expect(client.rpc).toHaveBeenCalledWith('delete_workshop_occurrence', {
      p_workshop_occurrence_id: occurrence.workshop_occurrence_id,
      p_command_key: 'command-delete',
    });
  });

  it('invokes the standalone catalog boundary and maps readiness identifiers', async () => {
    const result = {
      productId: 'prod_workshop',
      priceId: 'price_workshop',
      priceVersionId: 'version-1',
      reused: false,
    };
    client.functions.invoke.and.resolveTo({ data: result, error: null });

    await expectAsync(service.syncStripeCatalog('definition-1', 8500, 'command-1'))
      .toBeResolvedTo(result);
    expect(client.functions.invoke).toHaveBeenCalledWith('manage-workshop-catalog', {
      body: {
        definitionId: 'definition-1',
        amountMinor: 8500,
        currency: 'USD',
        commandKey: 'command-1',
      },
    });
  });

  it('creates a series and maps atomic generated occurrences', async () => {
    const series = workshopSeriesFixture();
    const occurrences = [
      workshopOccurrenceFixture({ workshop_series_id: series.workshop_series_id }),
      workshopOccurrenceFixture({
        workshop_occurrence_id: '10000000-0000-4000-8000-000000000099',
        workshop_series_id: series.workshop_series_id,
      }),
    ];
    client.from.and.returnValue(mutationResult(series));
    client.rpc.and.resolveTo({ data: occurrences, error: null });

    await service.createSeries({
      workshopDefinitionId: series.workshop_definition_id,
      label: ` ${series.series_label} `,
      capacity: series.default_capacity,
      priceMinor: series.default_price_minor,
      venueName: series.default_venue_name,
      addressLine1: series.default_address_line_1,
      locality: series.default_locality,
      region: series.default_region,
      postalCode: series.default_postal_code,
      country: series.default_country,
      timezone: series.default_timezone,
    });
    const generated = await service.generateSeries(
      series.workshop_series_id,
      occurrences.map((occurrence) => service.toDraft(occurrence)),
      'command-generate',
    );

    expect(generated).toEqual(occurrences);
    expect(client.rpc).toHaveBeenCalledWith('generate_workshop_series_occurrences', {
      p_workshop_series_id: series.workshop_series_id,
      p_dates: jasmine.any(Array),
      p_command_key: 'command-generate',
    });
  });

  it('previews and applies explicit series update scopes', async () => {
    const series = workshopSeriesFixture();
    const result = {
      occurrenceIds: ['occurrence-1', 'occurrence-2'],
      bookedOccurrenceIds: ['occurrence-2'],
    };
    client.rpc.and.resolveTo({ data: result, error: null });

    const preview = await service.previewSeriesUpdate(
      series.workshop_series_id,
      ['occurrence-1'],
      { scope: 'all_future', priceMinor: 9500 },
    );
    const applied = await service.applySeriesUpdate(
      series.workshop_series_id,
      result.occurrenceIds,
      {
        scope: 'selected',
        priceMinor: 9500,
        confirmedBookedOccurrenceIds: result.bookedOccurrenceIds,
      },
      'command-update',
    );

    expect(preview).toEqual(result);
    expect(applied).toEqual(result);
    expect(client.rpc.calls.argsFor(0)[1]).toEqual(jasmine.objectContaining({
      p_patch: jasmine.objectContaining({ scope: 'all_future', previewOnly: true }),
    }));
    expect(client.rpc.calls.argsFor(1)[1]).toEqual(jasmine.objectContaining({
      p_patch: jasmine.objectContaining({ scope: 'selected', previewOnly: false }),
      p_command_key: 'command-update',
    }));
  });
});

function selectOrderResult<T>(data: T[]) {
  const query = {
    select: jasmine.createSpy('select'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.order.and.resolveTo({ data, error: null });
  return query;
}

function mutationResult<T>(data: T) {
  const query = {
    insert: jasmine.createSpy('insert'),
    update: jasmine.createSpy('update'),
    eq: jasmine.createSpy('eq'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.insert.and.returnValue(query);
  query.update.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo({ data, error: null });
  return query;
}

function countResult(count: number) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
  };
  query.select.and.returnValue(query);
  query.eq.and.resolveTo({ count, error: null });
  return query;
}
