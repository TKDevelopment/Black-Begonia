import { TestBed } from '@angular/core/testing';

import { testOrganization, testProject } from '../../testing/workflow-fixtures';
import {
  createSupabaseClientWithQuery,
  supabaseFailure,
  supabaseSuccess,
} from '../../testing/supabase-testing';
import { SupabaseService } from '../clients/supabase.service';
import { OrganizationRepositoryService } from './organization-repository.service';

describe('OrganizationRepositoryService', () => {
  let service: OrganizationRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(() => {
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);

    TestBed.configureTestingModule({
      providers: [
        OrganizationRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(OrganizationRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads organizations ordered by name', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess([testOrganization]));
    supabaseService.getClient.and.returnValue(client as never);

    const organizations = await service.getOrganizations();

    expect(client.from).toHaveBeenCalledWith('organizations');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('organization_id'));
    expect(query.order).toHaveBeenCalledWith('name', { ascending: true });
    expect(organizations).toEqual([testOrganization]);
  });

  it('returns an empty list and logs when organization loading fails', async () => {
    const response = supabaseFailure('organizations failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getOrganizations()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[OrganizationRepositoryService] getOrganizations error:',
      response.error
    );
  });

  it('returns an empty list when organization loading has no rows', async () => {
    const { client } = createSupabaseClientWithQuery(supabaseSuccess(null));
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(service.getOrganizations()).toBeResolvedTo([]);
  });

  it('loads an organization by id and returns null on errors', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testOrganization));
    supabaseService.getClient.and.returnValue(client as never);

    const organization = await service.getOrganizationById(testOrganization.organization_id);

    expect(query.eq).toHaveBeenCalledWith(
      'organization_id',
      testOrganization.organization_id
    );
    expect(query.single).toHaveBeenCalled();
    expect(organization).toEqual(testOrganization);
  });

  it('normalizes create payloads before inserting', async () => {
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testOrganization));
    supabaseService.getClient.and.returnValue(client as never);

    await service.createOrganization({
      name: ' Test Venue Collective ',
      organization_type: 'venue',
      email: ' EVENTS@EXAMPLE.TEST ',
      phone: ' 555-0120 ',
      website: ' https://venue.example.test ',
      address_line_1: ' 200 Fixture Street ',
      address_line_2: '',
      city: ' Austin ',
      state: ' TX ',
      postal_code: ' 78702 ',
      country: '',
      notes: ' Synthetic organization fixture. ',
      created_from_lead_id: 'lead-test-001',
    });

    expect(query.insert).toHaveBeenCalledWith({
      name: 'Test Venue Collective',
      organization_type: 'venue',
      email: 'events@example.test',
      phone: '555-0120',
      website: 'https://venue.example.test',
      address_line_1: '200 Fixture Street',
      address_line_2: null,
      city: 'Austin',
      state: 'TX',
      postal_code: '78702',
      country: 'US',
      notes: 'Synthetic organization fixture.',
      created_from_lead_id: 'lead-test-001',
    });
  });

  it('throws when creating an organization fails', async () => {
    const response = supabaseFailure('insert failed');
    const { client } = createSupabaseClientWithQuery(response);
    supabaseService.getClient.and.returnValue(client as never);

    await expectAsync(
      service.createOrganization({
        name: 'Venue',
        organization_type: 'venue',
      })
    ).toBeRejectedWith(response.error as Error);
  });

  it('updates an organization with an updated timestamp', async () => {
    jasmine.clock().install();
    jasmine.clock().mockDate(new Date('2026-06-02T15:00:00.000Z'));
    const { client, query } = createSupabaseClientWithQuery(supabaseSuccess(testOrganization));
    supabaseService.getClient.and.returnValue(client as never);

    await service.updateOrganization(testOrganization.organization_id, {
      notes: 'Updated',
    });

    expect(query.update).toHaveBeenCalledWith({
      notes: 'Updated',
      updated_at: '2026-06-02T15:00:00.000Z',
    });
    expect(query.eq).toHaveBeenCalledWith(
      'organization_id',
      testOrganization.organization_id
    );
    jasmine.clock().uninstall();
  });

  it('loads related projects and filters empty joins', async () => {
    const { client, query } = createSupabaseClientWithQuery(
      supabaseSuccess([{ project: testProject }, { project: null }])
    );
    supabaseService.getClient.and.returnValue(client as never);

    const projects = await service.getRelatedProjects(testOrganization.organization_id);

    expect(client.from).toHaveBeenCalledWith('project_organizations');
    expect(query.eq).toHaveBeenCalledWith(
      'organization_id',
      testOrganization.organization_id
    );
    expect(projects).toEqual([testProject]);
  });
});
