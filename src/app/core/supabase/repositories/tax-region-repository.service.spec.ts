import { TestBed } from '@angular/core/testing';

import { testTaxRegion } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { TaxRegionRepositoryService } from './tax-region-repository.service';

describe('TaxRegionRepositoryService', () => {
  let service: TaxRegionRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        TaxRegionRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(TaxRegionRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads tax regions ordered by name', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([testTaxRegion]));
    supabaseService.getClient.and.returnValue(client as never);

    const regions = await service.getTaxRegions();

    expect(client.from).toHaveBeenCalledWith('tax_regions');
    expect(query.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(regions).toEqual([testTaxRegion]);
  });

  it('returns empty lists and logs when tax region loading fails', async () => {
    const response = supabaseFailure('tax failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getTaxRegions()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TaxRegionRepositoryService] getTaxRegions error:',
      response.error
    );
  });

  it('loads a tax region by id', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testTaxRegion));
    supabaseService.getClient.and.returnValue(client as never);

    const region = await service.getTaxRegionById(testTaxRegion.tax_region_id);

    expect(query.eq).toHaveBeenCalledWith('tax_region_id', testTaxRegion.tax_region_id);
    expect(query.single).toHaveBeenCalled();
    expect(region).toEqual(testTaxRegion);
  });

  it('returns null and logs when loading one tax region fails', async () => {
    const response = supabaseFailure('tax region failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getTaxRegionById('missing')).toBeResolvedTo(null);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[TaxRegionRepositoryService] getTaxRegionById error:',
      response.error
    );
  });

  it('normalizes create payload defaults before inserting', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testTaxRegion));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createTaxRegion({
      name: ' Austin Test Tax ',
      authority_name: ' ',
      tax_rate: 0.0825,
    });

    expect(query.insert).toHaveBeenCalledWith({
      name: 'Austin Test Tax',
      authority_name: null,
      tax_rate: 0.0825,
      applies_to_products: true,
      applies_to_services: true,
      applies_to_delivery: true,
      is_active: true,
    });
  });

  it('throws when creating a tax region fails', async () => {
    const response = supabaseFailure('tax insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createTaxRegion({ name: 'Austin', tax_rate: 0.0825 })
    ).toBeRejectedWith(response.error as Error);
  });

  it('updates tax regions with an updated timestamp', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-02T15:00:00.000Z'));
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testTaxRegion));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateTaxRegion(testTaxRegion.tax_region_id, { is_active: false });

    expect(query.update).toHaveBeenCalledWith({
      is_active: false,
      updated_at: '2026-06-02T15:00:00.000Z',
    });
    expect(query.eq).toHaveBeenCalledWith('tax_region_id', testTaxRegion.tax_region_id);
    jasmine.clock().uninstall();
  });
});
