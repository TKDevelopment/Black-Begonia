import { TestBed } from '@angular/core/testing';

import { testCatalogItem } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { CatalogItemRepositoryService } from './catalog-item-repository.service';

describe('CatalogItemRepositoryService', () => {
  let service: CatalogItemRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        CatalogItemRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(CatalogItemRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads catalog items ordered by name', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([testCatalogItem]));
    supabaseService.getClient.and.returnValue(client as never);

    const items = await service.getCatalogItems();

    expect(client.from).toHaveBeenCalledWith('catalog_items');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('item_id'));
    expect(query.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(items).toEqual([testCatalogItem]);
  });

  it('returns empty lists and logs when catalog loading fails', async () => {
    const response = supabaseFailure('catalog failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getCatalogItems()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CatalogItemRepositoryService] getCatalogItems error:',
      response.error
    );
  });

  it('loads a catalog item by id', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testCatalogItem));
    supabaseService.getClient.and.returnValue(client as never);

    const item = await service.getCatalogItemById(testCatalogItem.item_id);

    expect(query.eq).toHaveBeenCalledWith('item_id', testCatalogItem.item_id);
    expect(query.single).toHaveBeenCalled();
    expect(item).toEqual(testCatalogItem);
  });

  it('returns null and logs when loading one catalog item fails', async () => {
    const response = supabaseFailure('catalog item failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getCatalogItemById('missing')).toBeResolvedTo(null);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[CatalogItemRepositoryService] getCatalogItemById error:',
      response.error
    );
  });

  it('normalizes create payload defaults before inserting', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testCatalogItem));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createCatalogItem({
      name: ' Garden Rose ',
      item_type: 'flower',
      unit_type: 'bunch',
      pack_quantity: undefined,
      color: ' Blush ',
      variety: '',
      sku: ' ROSE-JULIET ',
      base_unit_cost: 30,
    });

    expect(query.insert).toHaveBeenCalledWith({
      name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      pack_quantity: null,
      color: 'Blush',
      variety: null,
      sku: 'ROSE-JULIET',
      base_unit_cost: 30,
      default_waste_percent: 0,
      is_active: true,
    });
  });

  it('throws when catalog item mutations fail', async () => {
    const response = supabaseFailure('catalog insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createCatalogItem({
        name: 'Rose',
        item_type: 'flower',
        unit_type: 'stem',
        base_unit_cost: 3,
      })
    ).toBeRejectedWith(response.error as Error);
  });

  it('updates catalog items with an updated timestamp', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-02T15:00:00.000Z'));
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testCatalogItem));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateCatalogItem(testCatalogItem.item_id, { name: 'Updated' });

    expect(query.update).toHaveBeenCalledWith({
      name: 'Updated',
      updated_at: '2026-06-02T15:00:00.000Z',
    });
    expect(query.eq).toHaveBeenCalledWith('item_id', testCatalogItem.item_id);
    jasmine.clock().uninstall();
  });
});
