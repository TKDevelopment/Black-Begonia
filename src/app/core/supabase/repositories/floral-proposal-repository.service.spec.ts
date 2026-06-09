import { TestBed } from '@angular/core/testing';

import {
  FloralProposalComponent,
  FloralProposalLineItem,
  FloralProposalShoppingListItem,
} from '../../models/floral-proposal';
import {
  testFloralProposal,
  testProposalLineItem,
} from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { FloralProposalRepositoryService } from './floral-proposal-repository.service';

describe('FloralProposalRepositoryService', () => {
  let service: FloralProposalRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: { from: jasmine.Spy };
  let consoleErrorSpy: jasmine.Spy;

  const proposalRow = {
    ...testFloralProposal,
  };

  const component: FloralProposalComponent = {
    floral_proposal_component_id: 'component-test-001',
    floral_proposal_line_item_id: testProposalLineItem.floral_proposal_line_item_id,
    display_order: 0,
    catalog_item_id: 'catalog-rose-001',
    catalog_item_name: 'Garden Rose',
    quantity_per_unit: 10,
    extended_quantity: 20,
    base_unit_cost: 3,
    applied_markup_percent: 50,
    sell_unit_price: 4.5,
    subtotal: 45,
    reserve_percent: 10,
    snapshot: {},
    created_at: '2026-06-02T12:00:00.000Z',
    updated_at: '2026-06-02T12:00:00.000Z',
  };

  beforeEach(() => {
    client = {
      from: jasmine.createSpy('from'),
    };
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
    ]);
    supabaseService.getClient.and.returnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        FloralProposalRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(FloralProposalRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads all proposals newest first without requiring template joins', async () => {
    const query = createSelectOrderQuery({
      data: [proposalRow],
      error: null,
    });
    client.from.and.returnValue(query);

    const proposals = await service.getAllProposals();

    expect(client.from).toHaveBeenCalledWith('floral_proposals');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('floral_proposal_id'));
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(proposals[0]).toEqual(testFloralProposal);
  });

  it('returns empty proposal lists when list queries fail', async () => {
    const error = new Error('list failed');
    client.from.and.returnValue(createSelectOrderQuery({ data: null, error }));

    const proposals = await service.getAllProposals();

    expect(proposals).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalRepositoryService] getAllProposals error:',
      error
    );
  });

  it('loads lead proposals newest version first', async () => {
    const query = createSelectEqOrderQuery({
      data: [testFloralProposal],
      error: null,
    });
    client.from.and.returnValue(query);

    const proposals = await service.getLeadFloralProposals('lead-test-001');

    expect(query.eq).toHaveBeenCalledWith('lead_id', 'lead-test-001');
    expect(query.order).toHaveBeenCalledWith('version', { ascending: false });
    expect(proposals).toEqual([testFloralProposal]);
  });

  it('loads one proposal and the active proposal with maybeSingle queries', async () => {
    const proposalQuery = createSelectEqMaybeSingleQuery({
      data: testFloralProposal,
      error: null,
    });
    const activeQuery = createSelectEqOrderLimitMaybeSingleQuery({
      data: testFloralProposal,
      error: null,
    });
    client.from.and.returnValues(proposalQuery, activeQuery);

    const proposal = await service.getFloralProposalById('proposal-test-001');
    const active = await service.getActiveLeadFloralProposal('lead-test-001');

    expect(proposalQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_id',
      'proposal-test-001'
    );
    expect(proposalQuery.maybeSingle).toHaveBeenCalled();
    expect(activeQuery.eq).toHaveBeenCalledWith('lead_id', 'lead-test-001');
    expect(activeQuery.eq).toHaveBeenCalledWith('is_active', true);
    expect(activeQuery.order).toHaveBeenCalledWith('version', { ascending: false });
    expect(activeQuery.limit).toHaveBeenCalledWith(1);
    expect(proposal).toEqual(testFloralProposal);
    expect(active).toEqual(testFloralProposal);
  });

  it('returns null when single proposal lookups fail', async () => {
    const error = new Error('lookup failed');
    client.from.and.returnValue(createSelectEqMaybeSingleQuery({ data: null, error }));

    const proposal = await service.getFloralProposalById('proposal-test-001');

    expect(proposal).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalRepositoryService] getFloralProposalById error:',
      error
    );
  });

  it('loads proposal line items and components in display order', async () => {
    const lineQuery = createSelectEqOrderQuery({
      data: [testProposalLineItem],
      error: null,
    });
    const componentQuery = createSelectEqOrderQuery({
      data: [
        {
          ...component,
          floral_proposal_line_items: {
            floral_proposal_id: testFloralProposal.floral_proposal_id,
          },
        },
      ],
      error: null,
    });
    client.from.and.returnValues(lineQuery, componentQuery);

    const lineItems = await service.getFloralProposalLineItems(
      testFloralProposal.floral_proposal_id
    );
    const components = await service.getFloralProposalComponents(
      testFloralProposal.floral_proposal_id
    );

    expect(client.from).toHaveBeenCalledWith('floral_proposal_line_items');
    expect(client.from).toHaveBeenCalledWith('floral_proposal_components');
    expect(lineQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_id',
      testFloralProposal.floral_proposal_id
    );
    expect(componentQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_line_items.floral_proposal_id',
      testFloralProposal.floral_proposal_id
    );
    expect(lineItems).toEqual([testProposalLineItem]);
    expect(components[0]).toEqual(component);
  });

  it('creates and updates floral proposals with builder-centered payloads', async () => {
    const createQuery = createInsertSelectSingleQuery({
      data: testFloralProposal,
      error: null,
    });
    const updateQuery = createUpdateEqSelectSingleQuery({
      data: testFloralProposal,
      error: null,
    });
    client.from.and.returnValues(createQuery, updateQuery);

    const created = await service.createFloralProposal({
      lead_id: 'lead-test-001',
      customer_email: 'avery@example.test',
      passcode_hash: 'hashed-passcode',
      version: 1,
      subtotal: 100,
      tax_rate: 0.08,
      tax_amount: 8,
      total_amount: 108,
    });
    const updated = await service.updateFloralProposal('proposal-test-001', {
      status: 'submitted',
    });

    expect(createQuery.insert).toHaveBeenCalledWith(
      jasmine.objectContaining({
        lead_id: 'lead-test-001',
        tax_region_id: null,
        version: 1,
        is_active: true,
        status: 'draft',
        customer_email: 'avery@example.test',
        passcode_hash: 'hashed-passcode',
        terms_version: 'v1',
        privacy_policy_version: 'v1',
        finalized_at: null,
        edit_reopened_at: null,
        submitted_at: null,
        snapshot: {},
        created_by: null,
      })
    );
    expect(updateQuery.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        status: 'submitted',
        updated_at: jasmine.any(String),
      })
    );
    expect(updateQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_id',
      'proposal-test-001'
    );
    expect(created).toEqual(testFloralProposal);
    expect(updated).toEqual(testFloralProposal);
  });

  it('persists finalized snapshot state through generic proposal updates', async () => {
    const updateQuery = createUpdateEqSelectSingleQuery({
      data: {
        ...testFloralProposal,
        snapshot: {
          proposal_status: 'finalized',
          finalized_at: '2026-06-02T13:00:00.000Z',
        },
      },
      error: null,
    });
    client.from.and.returnValue(updateQuery);

    const updated = await service.updateFloralProposal('proposal-test-001', {
      status: 'draft',
      finalized_at: '2026-06-02T13:00:00.000Z',
      edit_reopened_at: null,
      snapshot: {
        proposal_status: 'finalized',
        finalized_at: '2026-06-02T13:00:00.000Z',
        edit_reopened_at: null,
      },
    } as any);

    expect(updateQuery.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        status: 'draft',
        finalized_at: '2026-06-02T13:00:00.000Z',
        snapshot: jasmine.objectContaining({
          proposal_status: 'finalized',
          finalized_at: '2026-06-02T13:00:00.000Z',
        }),
        updated_at: jasmine.any(String),
      })
    );
    expect(updated.snapshot).toEqual(
      jasmine.objectContaining({
        proposal_status: 'finalized',
      })
    );
  });

  it('throws create and update errors after logging repository context', async () => {
    const createError = new Error('create failed');
    const updateError = new Error('update failed');
    client.from.and.returnValues(
      createInsertSelectSingleQuery({ data: null, error: createError }),
      createUpdateEqSelectSingleQuery({ data: null, error: updateError })
    );

    await expectAsync(
      service.createFloralProposal({
        lead_id: 'lead-test-001',
        customer_email: 'avery@example.test',
        passcode_hash: 'hashed-passcode',
        version: 1,
        subtotal: 100,
        tax_rate: 0.08,
        tax_amount: 8,
        total_amount: 108,
      })
    ).toBeRejectedWith(createError);
    await expectAsync(
      service.updateFloralProposal('proposal-test-001', { status: 'submitted' })
    ).toBeRejectedWith(updateError);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalRepositoryService] createFloralProposal error:',
      createError
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[FloralProposalRepositoryService] updateFloralProposal error:',
      updateError
    );
  });

  it('replaces line items by deleting existing rows before inserting ordered rows', async () => {
    const deleteQuery = createDeleteEqQuery({ error: null });
    const insertQuery = createInsertSelectOrderQuery({
      data: [testProposalLineItem],
      error: null,
    });
    client.from.and.returnValues(deleteQuery, insertQuery);

    const lineItems = await service.replaceFloralProposalLineItems(
      testFloralProposal.floral_proposal_id,
      [
        {
          display_order: 0,
          line_item_type: 'product',
          item_name: 'Ceremony Meadow',
          quantity: 2,
          unit_price: 300,
          subtotal: 600,
          image_storage_path: 'proposal-images/meadow.jpg',
          image_alt_text: 'Ceremony meadow',
          image_caption: 'A meadow arrangement',
          snapshot: { description: 'Lush aisle florals' },
        },
      ]
    );

    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_id',
      testFloralProposal.floral_proposal_id
    );
    expect(insertQuery.insert).toHaveBeenCalledWith([
      jasmine.objectContaining({
        floral_proposal_id: testFloralProposal.floral_proposal_id,
        display_order: 0,
        item_name: 'Ceremony Meadow',
        image_storage_path: 'proposal-images/meadow.jpg',
      }),
    ]);
    expect(lineItems).toEqual([testProposalLineItem]);
  });

  it('skips line item insertion when replacement payload is empty', async () => {
    const deleteQuery = createDeleteEqQuery({ error: null });
    client.from.and.returnValue(deleteQuery);

    const lineItems = await service.replaceFloralProposalLineItems(
      testFloralProposal.floral_proposal_id,
      []
    );

    expect(lineItems).toEqual([]);
    expect(client.from).toHaveBeenCalledTimes(1);
  });

  it('replaces components by deleting existing line item component rows and inserting mapped components', async () => {
    const deleteQuery = createDeleteInQuery({ error: null });
    const insertQuery = createInsertQuery({ error: null });
    client.from.and.returnValues(deleteQuery, insertQuery);

    await service.replaceFloralProposalComponents([testProposalLineItem], {
      [testProposalLineItem.floral_proposal_line_item_id]: [component],
    });

    expect(deleteQuery.delete).toHaveBeenCalled();
    expect(deleteQuery.in).toHaveBeenCalledWith('floral_proposal_line_item_id', [
      testProposalLineItem.floral_proposal_line_item_id,
    ]);
    expect(insertQuery.insert).toHaveBeenCalledWith([
      jasmine.objectContaining({
        floral_proposal_line_item_id:
          testProposalLineItem.floral_proposal_line_item_id,
        catalog_item_name: 'Garden Rose',
        reserve_percent: 10,
      }),
    ]);
  });

  it('clears line item images by nulling storage metadata', async () => {
    const query = createUpdateEqQuery({ error: null });
    client.from.and.returnValue(query);

    await service.clearLineItemImage('line-item-001');

    expect(client.from).toHaveBeenCalledWith('floral_proposal_line_items');
    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        image_storage_path: null,
        image_alt_text: null,
        image_caption: null,
        updated_at: jasmine.any(String),
      })
    );
    expect(query.eq).toHaveBeenCalledWith(
      'floral_proposal_line_item_id',
      'line-item-001'
    );
  });

  it('creates a shopping list when none exists and inserts mapped items', async () => {
    const existingQuery = createSelectEqMaybeSingleQuery({
      data: null,
      error: null,
    });
    const createListQuery = createInsertSelectSingleQuery({
      data: {
        floral_proposal_shopping_list_id: 'shopping-list-001',
        floral_proposal_id: testFloralProposal.floral_proposal_id,
        status: 'generated',
        generated_at: '2026-06-02T12:00:00.000Z',
        exported_at: null,
        created_at: '2026-06-02T12:00:00.000Z',
        updated_at: '2026-06-02T12:00:00.000Z',
      },
      error: null,
    });
    const itemInsertQuery = createInsertQuery({ error: null });
    client.from.and.returnValues(existingQuery, createListQuery, itemInsertQuery);

    const item: FloralProposalShoppingListItem = {
      catalog_item_id: 'catalog-rose-001',
      item_name: 'Garden Rose',
      item_type: 'flower',
      unit_type: 'bunch',
      required_units: 20,
      reserve_percent: 10,
      reserve_units: 10,
      total_units_to_buy: 30,
      units_per_pack: 10,
      required_pack_count: 3,
      estimated_pack_cost: 30,
      total_estimated_cost: 90,
      notes: 'Buy in packs of 10.',
    };

    const list = await service.upsertShoppingList(
      testFloralProposal.floral_proposal_id,
      [item]
    );

    expect(createListQuery.insert).toHaveBeenCalledWith({
      floral_proposal_id: testFloralProposal.floral_proposal_id,
      status: 'generated',
    });
    expect(itemInsertQuery.insert).toHaveBeenCalledWith([
      jasmine.objectContaining({
        floral_proposal_shopping_list_id: 'shopping-list-001',
        catalog_item_id: 'catalog-rose-001',
        item_name: 'Garden Rose',
        required_units: 20,
        notes: 'Buy in packs of 10.',
      }),
    ]);
    expect(list?.floral_proposal_shopping_list_id).toBe('shopping-list-001');
  });

  it('clears existing shopping list items before reinserting current items', async () => {
    const existingList = {
      floral_proposal_shopping_list_id: 'shopping-list-001',
      floral_proposal_id: testFloralProposal.floral_proposal_id,
      status: 'generated',
      generated_at: '2026-06-02T12:00:00.000Z',
      exported_at: null,
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
    };
    const existingQuery = createSelectEqMaybeSingleQuery({
      data: existingList,
      error: null,
    });
    const clearQuery = createDeleteEqQuery({ error: null });
    client.from.and.returnValues(existingQuery, clearQuery);

    const list = await service.upsertShoppingList(
      testFloralProposal.floral_proposal_id,
      []
    );

    expect(clearQuery.delete).toHaveBeenCalled();
    expect(clearQuery.eq).toHaveBeenCalledWith(
      'floral_proposal_shopping_list_id',
      'shopping-list-001'
    );
    expect(list).toEqual(existingList as never);
  });
});

function createSelectOrderQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.order.and.resolveTo(result);
  return query;
}

function createSelectEqOrderQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.order.and.resolveTo(result);
  return query;
}

function createSelectEqMaybeSingleQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    maybeSingle: jasmine.createSpy('maybeSingle'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.maybeSingle.and.resolveTo(result);
  return query;
}

function createSelectEqOrderLimitMaybeSingleQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    order: jasmine.createSpy('order'),
    limit: jasmine.createSpy('limit'),
    maybeSingle: jasmine.createSpy('maybeSingle'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.order.and.returnValue(query);
  query.limit.and.returnValue(query);
  query.maybeSingle.and.resolveTo(result);
  return query;
}

function createInsertSelectSingleQuery(result: unknown) {
  const query = {
    insert: jasmine.createSpy('insert'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.insert.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo(result);
  return query;
}

function createUpdateEqSelectSingleQuery(result: unknown) {
  const query = {
    update: jasmine.createSpy('update'),
    eq: jasmine.createSpy('eq'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.update.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo(result);
  return query;
}

function createDeleteEqQuery(result: unknown) {
  const query = {
    delete: jasmine.createSpy('delete'),
    eq: jasmine.createSpy('eq'),
  };
  query.delete.and.returnValue(query);
  query.eq.and.resolveTo(result);
  return query;
}

function createDeleteInQuery(result: unknown) {
  const query = {
    delete: jasmine.createSpy('delete'),
    in: jasmine.createSpy('in'),
  };
  query.delete.and.returnValue(query);
  query.in.and.resolveTo(result);
  return query;
}

function createInsertSelectOrderQuery(result: unknown) {
  const query = {
    insert: jasmine.createSpy('insert'),
    select: jasmine.createSpy('select'),
    order: jasmine.createSpy('order'),
  };
  query.insert.and.returnValue(query);
  query.select.and.returnValue(query);
  query.order.and.resolveTo(result);
  return query;
}

function createInsertQuery(result: unknown) {
  const query = {
    insert: jasmine.createSpy('insert'),
  };
  query.insert.and.resolveTo(result);
  return query;
}

function createUpdateEqQuery(result: unknown) {
  const query = {
    update: jasmine.createSpy('update'),
    eq: jasmine.createSpy('eq'),
  };
  query.update.and.returnValue(query);
  query.eq.and.resolveTo(result);
  return query;
}
