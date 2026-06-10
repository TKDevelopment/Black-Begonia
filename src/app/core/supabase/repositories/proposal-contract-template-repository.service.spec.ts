import { TestBed } from '@angular/core/testing';

import { ProposalContractTemplate } from '../../models/proposal-contract-template';
import { SupabaseService } from '../clients/supabase.service';
import { ProposalContractTemplateRepositoryService } from './proposal-contract-template-repository.service';

describe('ProposalContractTemplateRepositoryService', () => {
  let service: ProposalContractTemplateRepositoryService;
  let fromSpy: jasmine.Spy;
  let consoleErrorSpy: jasmine.Spy;
  let tableApi: {
    select: jasmine.Spy;
    order: jasmine.Spy;
    eq: jasmine.Spy;
    maybeSingle: jasmine.Spy;
    update: jasmine.Spy;
    insert: jasmine.Spy;
    single: jasmine.Spy;
  };

  beforeEach(() => {
    tableApi = {
      select: jasmine.createSpy('select'),
      order: jasmine.createSpy('order'),
      eq: jasmine.createSpy('eq'),
      maybeSingle: jasmine.createSpy('maybeSingle'),
      update: jasmine.createSpy('update'),
      insert: jasmine.createSpy('insert'),
      single: jasmine.createSpy('single'),
    };

    fromSpy = jasmine.createSpy('from').and.returnValue(tableApi);
    tableApi.select.and.returnValue(tableApi);
    tableApi.order.and.returnValue(tableApi);
    tableApi.eq.and.returnValue(tableApi);
    tableApi.update.and.returnValue(tableApi);
    tableApi.insert.and.returnValue(tableApi);
    tableApi.maybeSingle.and.resolveTo({ data: null, error: null });
    tableApi.single.and.resolveTo({ data: buildTemplate(), error: null });

    TestBed.configureTestingModule({
      providers: [
        ProposalContractTemplateRepositoryService,
        {
          provide: SupabaseService,
          useValue: {
            getClient: () => ({
              from: fromSpy,
            }),
          },
        },
      ],
    });

    service = TestBed.inject(ProposalContractTemplateRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads templates with active-first ordering and returns empty lists on failures', async () => {
    tableApi.order.and.returnValues(tableApi, Promise.resolve({
      data: [buildTemplate(), buildTemplate({ proposal_contract_template_id: 'template-002' })],
      error: null,
    }) as never);

    const templates = await service.getTemplates();

    expect(fromSpy).toHaveBeenCalledWith('proposal_contract_templates');
    expect(tableApi.order.calls.argsFor(0)).toEqual(['is_active', { ascending: false }]);
    expect(tableApi.order.calls.argsFor(1)).toEqual(['display_name', { ascending: true }]);
    expect(templates.length).toBe(2);

    tableApi.order.calls.reset();
    tableApi.order.and.returnValues(tableApi, Promise.resolve({
      data: null,
      error: new Error('load failed'),
    }) as never);

    await expectAsync(service.getTemplates()).toBeResolvedTo([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalContractTemplateRepositoryService] getTemplates error:',
      jasmine.any(Error)
    );
  });

  it('loads the active template and returns null on repository errors', async () => {
    tableApi.maybeSingle.and.resolveTo({
      data: buildTemplate(),
      error: null,
    });

    const activeTemplate = await service.getActiveTemplate();

    expect(activeTemplate?.proposal_contract_template_id).toBe('template-001');

    tableApi.maybeSingle.and.resolveTo({
      data: null,
      error: new Error('missing'),
    });

    await expectAsync(service.getActiveTemplate()).toBeResolvedTo(null);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalContractTemplateRepositoryService] getActiveTemplate error:',
      jasmine.any(Error)
    );
  });

  it('creates templates with normalized values and default provider metadata', async () => {
    await service.createTemplate({
      provider_template_id: ' signwell-template-001 ',
      provider_template_name: ' Standard Contract ',
      provider_template_revision: ' rev-2026 ',
      display_name: ' Black Begonia Standard Contract ',
      description: ' Reusable proposal contract. ',
      required_field_map: {
        customer_name: 'lead.full_name',
      },
      is_active: true,
    });

    expect(tableApi.insert).toHaveBeenCalledWith({
      provider: 'signwell',
      provider_template_id: 'signwell-template-001',
      provider_template_name: 'Standard Contract',
      provider_template_revision: 'rev-2026',
      is_active: true,
      display_name: 'Black Begonia Standard Contract',
      description: 'Reusable proposal contract.',
      required_field_map: {
        customer_name: 'lead.full_name',
      },
    });
  });

  it('clears the previous active template before setting a new active template', async () => {
    tableApi.single.and.resolveTo({
      data: buildTemplate({ proposal_contract_template_id: 'template-002', is_active: true }),
      error: null,
    });

    const result = await service.setActiveTemplate('template-002');

    expect(tableApi.update.calls.argsFor(0)[0]).toEqual(
      jasmine.objectContaining({
        is_active: false,
        updated_at: jasmine.any(String),
      })
    );
    expect(tableApi.eq.calls.argsFor(0)).toEqual(['is_active', true]);
    expect(tableApi.update.calls.argsFor(1)[0]).toEqual(
      jasmine.objectContaining({
        is_active: true,
        updated_at: jasmine.any(String),
      })
    );
    expect(tableApi.eq.calls.argsFor(1)).toEqual([
      'proposal_contract_template_id',
      'template-002',
    ]);
    expect(result.proposal_contract_template_id).toBe('template-002');
  });

  it('updates templates and rethrows set-active or update failures', async () => {
    await service.updateTemplate('template-001', {
      display_name: 'Updated Contract Name',
    });

    expect(tableApi.update).toHaveBeenCalledWith(
      jasmine.objectContaining({
        display_name: 'Updated Contract Name',
        updated_at: jasmine.any(String),
      })
    );

    tableApi.update.calls.reset();
    tableApi.eq.calls.reset();
    tableApi.single.and.resolveTo({
      data: null,
      error: new Error('update failed'),
    });

    await expectAsync(
      service.updateTemplate('template-001', { display_name: 'Broken' })
    ).toBeRejectedWithError('update failed');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalContractTemplateRepositoryService] updateTemplate error:',
      jasmine.any(Error)
    );

    tableApi.update.calls.reset();
    tableApi.eq.calls.reset();
    tableApi.single.and.resolveTo({ data: buildTemplate(), error: null });
    tableApi.eq.and.returnValues(
      Promise.resolve({ error: new Error('clear failed') }) as never,
      tableApi
    );

    await expectAsync(service.setActiveTemplate('template-001')).toBeRejectedWithError(
      'clear failed'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProposalContractTemplateRepositoryService] setActiveTemplate clear error:',
      jasmine.any(Error)
    );
  });

  function buildTemplate(
    overrides: Partial<ProposalContractTemplate> = {}
  ): ProposalContractTemplate {
    return {
      proposal_contract_template_id: 'template-001',
      provider: 'signwell',
      provider_template_id: 'signwell-template-001',
      provider_template_name: 'Standard Contract',
      provider_template_revision: 'rev-2026',
      is_active: true,
      display_name: 'Black Begonia Standard Contract',
      description: 'Reusable proposal contract.',
      required_field_map: {
        customer_name: 'lead.full_name',
      },
      created_by: 'user-001',
      created_at: '2026-06-02T12:00:00.000Z',
      updated_at: '2026-06-02T12:00:00.000Z',
      ...overrides,
    };
  }
}
