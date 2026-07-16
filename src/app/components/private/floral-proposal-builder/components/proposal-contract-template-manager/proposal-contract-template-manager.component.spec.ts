import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalContractTemplate } from '../../../../../core/models/proposal-contract-template';
import { ProposalContractTemplateManagerComponent } from './proposal-contract-template-manager.component';

describe('ProposalContractTemplateManagerComponent', () => {
  let component: ProposalContractTemplateManagerComponent;
  let fixture: ComponentFixture<ProposalContractTemplateManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalContractTemplateManagerComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProposalContractTemplateManagerComponent);
    component = fixture.componentInstance;
  });

  it('renders configured and required states for contract templates', () => {
    fixture.detectChanges();
    expect(text()).toContain('Contract Template');
    expect(text()).toContain('Required');
    expect(text()).toContain('No SignWell contract templates have been configured yet.');

    component.templates = [buildTemplate()];
    component.activeTemplateId = 'template-001';
    fixture.detectChanges();

    expect(text()).toContain('Configured');
    expect(text()).toContain('Black Begonia Standard Contract');
    expect(text()).toContain('Active');
    expect(text()).toContain('__signwell');
  });

  it('validates required fields and invalid JSON before emitting create events', () => {
    const createSpy = spyOn(component.createTemplate, 'emit');

    component.submit();
    expect(createSpy).not.toHaveBeenCalled();
    expect(component.formError()).toBe(
      'Display name, provider template ID, and provider template name are required.'
    );

    component.displayName.set('Black Begonia Standard Contract');
    component.providerTemplateId.set('signwell-template-001');
    component.providerTemplateName.set('Standard Contract');
    component.requiredFieldMapJson.set('{bad-json');

    component.submit();
    expect(createSpy).not.toHaveBeenCalled();
    expect(component.formError()).toBe('Required field map must be valid JSON.');
  });

  it('emits normalized create payloads and resets the form after save', () => {
    const createSpy = spyOn(component.createTemplate, 'emit');

    component.displayName.set('  Black Begonia Standard Contract  ');
    component.providerTemplateId.set(' signwell-template-001 ');
    component.providerTemplateName.set(' Standard Contract ');
    component.providerTemplateRevision.set(' rev-2026 ');
    component.description.set(' Reusable proposal contract. ');
    component.requiredFieldMapJson.set(
      JSON.stringify({
        customer_name: 'lead.full_name',
        __signwell: {
          contract_pdf_url_template:
            'https://provider.example.test/contracts/{{template_id}}',
        },
      })
    );

    component.submit();

    expect(createSpy).toHaveBeenCalledWith({
      provider: 'signwell',
      provider_template_id: 'signwell-template-001',
      provider_template_name: 'Standard Contract',
      provider_template_revision: 'rev-2026',
      display_name: 'Black Begonia Standard Contract',
      description: 'Reusable proposal contract.',
      required_field_map: {
        customer_name: 'lead.full_name',
        __signwell: {
          contract_pdf_url_template:
            'https://provider.example.test/contracts/{{template_id}}',
        },
      },
      is_active: true,
    });
    expect(component.displayName()).toBe('');
    expect(component.providerTemplateId()).toBe('');
    expect(component.providerTemplateName()).toBe('');
  });

  it('emits activation only for inactive templates while not saving', () => {
    const activateSpy = spyOn(component.activateTemplate, 'emit');
    component.activeTemplateId = 'template-001';

    component.onActivate('template-001');
    expect(activateSpy).not.toHaveBeenCalled();

    component.onActivate('template-002');
    expect(activateSpy).toHaveBeenCalledWith('template-002');

    component.saving = true;
    component.onActivate('template-003');
    expect(activateSpy).toHaveBeenCalledTimes(1);
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

  function text(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }
});
