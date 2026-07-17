import { TestBed } from '@angular/core/testing';

import { testLead } from '../../testing/workflow-fixtures';
import { SupabaseService } from '../clients/supabase.service';
import { LeadRepositoryService } from './lead-repository.service';

describe('LeadRepositoryService', () => {
  let service: LeadRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: { from: jasmine.Spy };
  let consoleErrorSpy: jasmine.Spy;

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
        LeadRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(LeadRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('loads leads newest first', async () => {
    const query = createSelectOrderQuery({ data: [testLead], error: null });
    client.from.and.returnValue(query);

    const leads = await service.getLeads();

    expect(client.from).toHaveBeenCalledWith('leads');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('lead_id'));
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(leads).toEqual([testLead]);
  });

  it('returns an empty lead list when Supabase fails', async () => {
    const error = new Error('network unavailable');
    client.from.and.returnValue(createSelectOrderQuery({ data: null, error }));

    const leads = await service.getLeads();

    expect(leads).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadRepositoryService] getLeads error:',
      error
    );
  });

  it('loads one lead by id', async () => {
    const query = createSelectEqSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    const lead = await service.getLeadById(testLead.lead_id);

    expect(query.eq).toHaveBeenCalledWith('lead_id', testLead.lead_id);
    expect(query.single).toHaveBeenCalled();
    expect(lead).toEqual(testLead);
  });

  it('returns null when loading one lead fails', async () => {
    const error = new Error('not found');
    client.from.and.returnValue(createSelectEqSingleQuery({ data: null, error }));

    const lead = await service.getLeadById(testLead.lead_id);

    expect(lead).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadRepositoryService] getLeadById error:',
      error
    );
  });

  it('normalizes and creates a general lead', async () => {
    const query = createInsertSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    const lead = await service.createGeneralLead({
      service_type: 'Corporate Events',
      first_name: '  Iris ',
      last_name: ' Miller  ',
      email: ' IRIS@EXAMPLE.COM ',
      phone: ' 555-010-2000 ',
      preferred_contact_method: 'email',
      event_date: '',
      inquiry_message: '  Lobby flowers  ',
      source: '  referral ',
    });

    expect(query.insert).toHaveBeenCalledWith({
      service_type: 'corporate',
      event_type: 'general',
      first_name: 'Iris',
      last_name: 'Miller',
      email: 'iris@example.com',
      phone: '555-010-2000',
      preferred_contact_method: 'email',
      event_date: null,
      inquiry_message: 'Lobby flowers',
      source: 'other',
    });
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('lead_id'));
    expect(lead).toEqual(testLead);
  });

  it('normalizes and creates a wedding lead', async () => {
    const query = createInsertSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    await service.createWeddingLead({
      service_type: 'wedding-full-service',
      first_name: '  Iris ',
      last_name: ' Miller ',
      partner_first_name: '  Rowan ',
      partner_last_name: ' Lee ',
      email: ' IRIS@EXAMPLE.COM ',
      phone: '',
      preferred_contact_method: 'phone',
      event_date: '2026-10-24',
      ceremony_venue_name: '  Garden Hall ',
      ceremony_venue_city: '  Ann Arbor ',
      ceremony_venue_state: ' MI ',
      ceremony_start_time: '15:00',
      reception_venue_name: '',
      reception_venue_city: '',
      reception_venue_state: '',
      reception_start_time: '',
      event_start_time: '',
      budget_range: ' $3,000 - $5,000 ',
      guest_count: Number.NaN,
      inquiry_message: '  Ceremony and reception flowers ',
      planner_name: '  Casey Planner ',
      planner_phone: ' 555-010-3000 ',
      planner_email: ' casey@example.com ',
      source: 'referral',
    });

    expect(query.insert).toHaveBeenCalledWith({
      service_type: 'full-service wedding',
      event_type: 'wedding',
      first_name: 'Iris',
      last_name: 'Miller',
      partner_first_name: 'Rowan',
      partner_last_name: 'Lee',
      email: 'iris@example.com',
      phone: null,
      preferred_contact_method: 'phone',
      event_date: '2026-10-24',
      ceremony_venue_name: 'Garden Hall',
      ceremony_venue_city: 'Ann Arbor',
      ceremony_venue_state: 'MI',
      ceremony_venue_address: null,
      ceremony_venue_zipcode: null,
      ceremony_start_time: '15:00',
      reception_venue_name: null,
      reception_venue_city: null,
      reception_venue_state: null,
      reception_venue_address: null,
      reception_venue_zipcode: null,
      reception_start_time: null,
      event_start_time: null,
      budget_range: '$3,000 - $5,000',
      guest_count: null,
      inquiry_message: 'Ceremony and reception flowers',
      planner_name: 'Casey Planner',
      planner_phone: '555-010-3000',
      planner_email: 'casey@example.com',
      source: 'other',
    });
  });

  it('throws Supabase errors when lead creation fails', async () => {
    const error = new Error('insert failed');
    client.from.and.returnValue(createInsertSelectSingleQuery({ data: null, error }));

    await expectAsync(
      service.createGeneralLead({
        service_type: 'custom-installation',
        first_name: 'Iris',
        last_name: 'Miller',
        email: 'iris@example.com',
      })
    ).toBeRejectedWith(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadRepositoryService] createGeneralLead error:',
      error
    );
  });

  it('updates a lead and stamps updated_at', async () => {
    const query = createUpdateEqSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    const lead = await service.updateLead(testLead.lead_id, {
      status: 'contacted',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        status: 'contacted',
        updated_at: jasmine.any(String),
      })
    );
    expect(query.eq).toHaveBeenCalledWith('lead_id', testLead.lead_id);
    expect(lead).toEqual(testLead);
  });

  it('normalizes a service display label before updating an enum column', async () => {
    const query = createUpdateEqSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    await service.updateLead(testLead.lead_id, {
      event_type: 'wedding',
      service_type: 'Ceremony-Only Wedding',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        service_type: 'ceremony-only wedding',
        updated_at: jasmine.any(String),
      })
    );
  });

  it('normalizes lead source aliases and free text before update', async () => {
    const query = createUpdateEqSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    await service.updateLead(testLead.lead_id, {
      source: 'Personal Referral',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        source: 'other',
        updated_at: jasmine.any(String),
      })
    );

    query.update.calls.reset();
    await service.updateLead(testLead.lead_id, {
      source: 'Venue Partner',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        source: 'venue partner',
      })
    );

    query.update.calls.reset();
    await service.updateLead(testLead.lead_id, {
      source: 'crm',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        source: 'other',
      })
    );
  });

  it('normalizes event dates as date-only values before update', async () => {
    const query = createUpdateEqSelectSingleQuery({ data: testLead, error: null });
    client.from.and.returnValue(query);

    await service.updateLead(testLead.lead_id, {
      event_date: '2026-11-28T05:00:00.000Z',
    });

    expect(query.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        event_date: '2026-11-28',
        updated_at: jasmine.any(String),
      })
    );
  });

  it('throws Supabase errors when update fails', async () => {
    const error = new Error('update failed');
    client.from.and.returnValue(createUpdateEqSelectSingleQuery({ data: null, error }));

    await expectAsync(
      service.updateLead(testLead.lead_id, { status: 'contacted' })
    ).toBeRejectedWith(error);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadRepositoryService] updateLead error:',
      jasmine.objectContaining({ message: 'update failed' })
    );
  });

  it('deletes a lead by id', async () => {
    const query = createDeleteEqQuery({ error: null });
    client.from.and.returnValue(query);

    await service.deleteLead(testLead.lead_id);

    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith('lead_id', testLead.lead_id);
  });

  it('throws Supabase errors when delete fails', async () => {
    const error = new Error('delete failed');
    client.from.and.returnValue(createDeleteEqQuery({ error }));

    await expectAsync(service.deleteLead(testLead.lead_id)).toBeRejectedWith(
      error
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadRepositoryService] deleteLead error:',
      error
    );
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

function createSelectEqSingleQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    single: jasmine.createSpy('single'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.single.and.resolveTo(result);
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
