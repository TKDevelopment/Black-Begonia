import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { ActivityRepositoryService } from '../../../../core/supabase/repositories/activity-repository.service';
import { LeadRepositoryService } from '../../../../core/supabase/repositories/lead-repository.service';
import { ProjectPaymentRecordRepositoryService } from '../../../../core/supabase/repositories/project-payment-record-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../../../../core/supabase/repositories/project-proposal-document-version-repository.service';
import { ProjectProposalInvoiceSnapshotRepositoryService } from '../../../../core/supabase/repositories/project-proposal-invoice-snapshot-repository.service';
import { ProjectRepositoryService } from '../../../../core/supabase/repositories/project-repository.service';
import { SupabaseService } from '../../../../core/supabase/clients/supabase.service';
import { ProjectProposalRevisionService } from '../../../../core/supabase/services/project-proposal-revision.service';
import { ProjectWorkflowService } from '../../../../core/supabase/services/project-workflow.service';
import { PaymentDeliveryService } from '../../../../core/supabase/services/payment-delivery.service';
import { ProjectDetailsComponent } from './project-details.component';
import { ToastService } from '../../../../core/services/toast.service';
import { LeadConversionService } from '../../../../core/supabase/services/lead-conversion.service';

describe('ProjectDetailsComponent active proposal contracts', () => {
  let component: ProjectDetailsComponent;
  const resolver = new ProjectProposalRevisionService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const paymentRepository = jasmine.createSpyObj('ProjectPaymentRecordRepositoryService', ['getProjectPaymentRecords','getProjectFinancialSummary']);
  const activityRepository = jasmine.createSpyObj('ActivityRepositoryService', ['getProjectActivity']);
  const deliveryService = jasmine.createSpyObj('PaymentDeliveryService', ['getProjectDeliveries','setReminderControl','retry']);
  const documentRepository = jasmine.createSpyObj('ProjectProposalDocumentVersionRepositoryService', ['getProjectDocumentVersions']);
  const snapshotRepository = jasmine.createSpyObj('ProjectProposalInvoiceSnapshotRepositoryService', ['getProjectSnapshots']);
  const projectRepository = jasmine.createSpyObj('ProjectRepositoryService', ['cascadeDeleteProjectTestData']);
  const router = jasmine.createSpyObj('Router', ['navigate']);
  const toast = jasmine.createSpyObj('ToastService', ['showToast']);
  const leadConversion = jasmine.createSpyObj('LeadConversionService', ['issueDepositRequest']);
  const workflowService = jasmine.createSpyObj('ProjectWorkflowService', ['recordPayment']);
  const project = {
    project_id: 'project-1', project_name: 'Wedding', service_type: 'wedding', status: 'booked',
    active_proposal_invoice_snapshot_id: 'snapshot-2', active_proposal_document_version_id: 'document-2',
    created_at: '', updated_at: '',
  } as any;
  const snapshot = {
    project_proposal_invoice_snapshot_id: 'snapshot-2', project_id: 'project-1', version: 2, snapshot: {},
    subtotal: 100, tax_rate: .06, tax_amount: 6, total_amount: 106, retainer_amount: 30,
    final_balance_amount: 106, is_active: true, created_at: '',
  } as any;
  const document = {
    project_proposal_document_version_id: 'document-2', project_id: 'project-1', invoice_snapshot_id: 'snapshot-2',
    version: 2, file_name: 'v2.pdf', storage_bucket: 'floral-proposals', storage_path: 'v2.pdf',
    content_type: 'application/pdf', submitted_at: '', status: 'submitted', is_active: true, created_at: '',
  } as any;

  beforeEach(async () => {
    paymentRepository.getProjectPaymentRecords.and.resolveTo([]);
    paymentRepository.getProjectFinancialSummary.and.resolveTo({available:true,proposalTotal:106,depositTarget:31.8,finalTarget:74.2,creditedPrincipal:0,outstanding:106,customerFees:0,merchantFees:0,overpayment:0,obligations:[],needsAttention:[]});
    activityRepository.getProjectActivity.and.resolveTo([]);deliveryService.getProjectDeliveries.and.resolveTo([]);deliveryService.setReminderControl.and.resolveTo();deliveryService.retry.and.resolveTo({} as any);documentRepository.getProjectDocumentVersions.and.resolveTo([]);snapshotRepository.getProjectSnapshots.and.resolveTo([]);
    projectRepository.cascadeDeleteProjectTestData.and.resolveTo({
      projectId: 'project-1', projectName: 'Wedding', deletedSourceLead: true,
      deletedContacts: 1, deletedOrganizations: 0, storageObjects: [], storageCleanupFailures: 0,
    });
    router.navigate.and.resolveTo(true);
    leadConversion.issueDepositRequest.and.resolveTo('queued');
    await TestBed.configureTestingModule({
      imports: [ProjectDetailsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        { provide: Router, useValue: router },
        { provide: ProjectRepositoryService, useValue: projectRepository }, { provide: LeadRepositoryService, useValue: {} },
        { provide: ProjectPaymentRecordRepositoryService, useValue: paymentRepository }, { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: ProjectProposalDocumentVersionRepositoryService, useValue: documentRepository },
        { provide: ProjectProposalInvoiceSnapshotRepositoryService, useValue: snapshotRepository },
        { provide: ProjectWorkflowService, useValue: workflowService }, { provide: SupabaseService, useValue: {} },
        { provide: PaymentDeliveryService, useValue: deliveryService },
        { provide: ProjectProposalRevisionService, useValue: resolver },
        { provide: ToastService, useValue: toast },
        { provide: LeadConversionService, useValue: leadConversion },
      ],
    }).overrideComponent(ProjectDetailsComponent, { set: { template: '' } }).compileComponents();
    component = TestBed.createComponent(ProjectDetailsComponent).componentInstance;
    component.project.set(project);
  });

  it('uses only the exact project-pointer active snapshot and never latest history', () => {
    component.snapshots.set([{ ...snapshot, project_proposal_invoice_snapshot_id: 'snapshot-1', version: 1, is_active: false }, snapshot]);
    expect(component.activeSnapshot()).toBe(snapshot);
    component.project.set({ ...project, active_proposal_invoice_snapshot_id: 'missing' });
    expect(component.activeSnapshot()).toBeNull();
    expect(component.revisionDisabledReason()).toContain('does not match');
  });

  it('keeps revision eligible when only the active document is missing', () => {
    component.snapshots.set([snapshot]);
    component.documents.set([]);
    expect(component.revisionDisabledReason()).toBeNull();
    expect(component.activeDocument()).toBeNull();
    expect(component.documentDisabledReason()).toContain('could not be found');
  });

  it('requires the active document to link to the exact active snapshot', () => {
    component.snapshots.set([snapshot]);
    component.documents.set([{ ...document, invoice_snapshot_id: 'snapshot-1' }]);
    expect(component.activeDocument()).toBeNull();
    expect(component.documentDisabledReason()).toContain('does not match');
    component.documents.set([document]);
    expect(component.activeDocument()).toBe(document);
  });

  it('loads installments and summary from one shared financial RPC', async () => {
    paymentRepository.getProjectFinancialSummary.and.resolveTo({
      available:true,proposalTotal:106,depositTarget:31.8,finalTarget:74.2,creditedPrincipal:0,outstanding:106,
      customerFees:0,merchantFees:0,overpayment:0,needsAttention:[],
      obligations:[{project_payment_record_id:'deposit',project_id:'project-1',payment_kind:'deposit',status:'due',amount_due:31.8,amount_paid:0,target_amount:31.8,outstanding_amount:31.8,payment_source:'manual',created_at:'',updated_at:''}],
    });
    await component.loadSections('project-1');
    expect(paymentRepository.getProjectFinancialSummary).toHaveBeenCalledWith('project-1');
    expect(activityRepository.getProjectActivity).toHaveBeenCalledWith('project-1');
    expect(deliveryService.getProjectDeliveries).toHaveBeenCalledWith('project-1');
    expect(component.financialSummary()?.outstanding).toBe(106);
    expect(component.payments()[0].project_payment_record_id).toBe('deposit');
  });

  it('loads installment disclosures collapsed and toggles them accessibly', () => {
    expect(component.isInstallmentExpanded('deposit')).toBeFalse();
    component.toggleInstallment('deposit');
    expect(component.isInstallmentExpanded('deposit')).toBeTrue();
    component.toggleInstallment('deposit');
    expect(component.isInstallmentExpanded('deposit')).toBeFalse();
  });

  it('keeps Record Payment open when the command returns a spillover warning', async () => {
    component.paymentModalOpen.set(true);
    workflowService.recordPayment.and.resolveTo({ result: { state:'spillover_warning', spilloverAmount:10, proposedAllocations:[] }, project });
    await component.savePayment({ obligation_id:'deposit', payment_kind:'deposit', amount:100, received_at:'2026-01-01', payment_method:'cash', command_key:'command' });
    expect(component.paymentModalOpen()).toBeTrue();
    expect(component.paymentWarning()?.state).toBe('spillover_warning');
  });

  it('expands every affected installment after a recorded payment refresh', async () => {
    component.paymentModalOpen.set(true);
    workflowService.recordPayment.and.resolveTo({ result: {
      state:'recorded', replayed:false, transactionId:'receipt', paymentReference:'BBP-1', allocations:[],
      affectedObligationIds:['deposit','final'], overpaymentAmount:0,
    }, project });
    await component.savePayment({ obligation_id:'deposit', payment_kind:'deposit', amount:100, received_at:'2026-01-01', payment_method:'cash', command_key:'command' });
    expect(component.isInstallmentExpanded('deposit')).toBeTrue();
    expect(component.isInstallmentExpanded('final')).toBeTrue();
    expect(component.paymentModalOpen()).toBeFalse();
  });

  it('shows planned methods without treating them as received', () => {
    const payment:any={methodSummary:{state:'planned',label:'Cash (planned)'},credited_principal:0,status:'due'};
    expect(component.paymentMethodSummary(payment)).toBe('Cash (planned)');
    expect(payment.credited_principal).toBe(0);
  });

  it('keeps zero-dollar installments visible as Not Required and ineligible', () => {
    const payment:any={status:'not_due',displayStatus:'not_required',target_amount:0,outstanding_amount:0};
    expect(component.paymentStatus(payment)).toBe('Not Required');
    expect(component.canRecordPayment(payment)).toBeFalse();
  });

  it('uses an audited obligation reminder command without changing financial state locally', async () => {
    spyOn(window,'prompt').and.returnValue('Customer requested pause');
    const payment:any={project_payment_record_id:'deposit',project_id:'project-1',reminder_enabled:true};
    await component.toggleReminder(payment);
    expect(deliveryService.setReminderControl).toHaveBeenCalledWith('project-1','deposit',false,null,'Customer requested pause');
  });

  it('can recover a conversion request failure when no initial delivery exists', async () => {
    component.payments.set([{
      project_payment_record_id: 'deposit-1', project_id: 'project-1',
      payment_kind: 'deposit', status: 'due', outstanding_amount: 31.8,
    } as any]);
    component.paymentDeliveries.set([]);

    await component.sendDepositRequest();

    expect(leadConversion.issueDepositRequest).toHaveBeenCalledWith('deposit-1', 3180);
    expect(toast.showToast).toHaveBeenCalledWith('The secure deposit payment email was queued.');
  });

  it('requires both acknowledgement and the exact project name before deletion', () => {
    component.openDeleteConfirmation();
    component.deleteAcknowledged.set(true);
    component.deleteConfirmation.set('wedding');
    expect(component.canDeleteProject()).toBeFalse();

    component.deleteConfirmation.set('Wedding');
    expect(component.canDeleteProject()).toBeTrue();
  });

  it('uses the guarded cascade command and returns to the projects table', async () => {
    component.deleteAcknowledged.set(true);
    component.deleteConfirmation.set('Wedding');

    await component.deleteProject();

    expect(projectRepository.cascadeDeleteProjectTestData).toHaveBeenCalledWith('project-1', 'Wedding');
    expect(toast.showToast).toHaveBeenCalledWith('Project "Wedding" and its test data were deleted.');
    expect(router.navigate).toHaveBeenCalledWith(['/admin/projects']);
  });
});
