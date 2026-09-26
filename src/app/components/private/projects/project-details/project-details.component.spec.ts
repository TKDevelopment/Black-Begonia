import { ComponentFixture, TestBed } from '@angular/core/testing';
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

describe('ProjectDetailsComponent active proposal contracts', () => {
  let component: ProjectDetailsComponent;
  let fixture: ComponentFixture<ProjectDetailsComponent>;
  const resolver = new ProjectProposalRevisionService({} as any, {} as any, {} as any, {} as any, {} as any, {} as any);
  const paymentRepository = jasmine.createSpyObj('ProjectPaymentRecordRepositoryService', ['getProjectPaymentRecords','getProjectFinancialSummary','createRevisionInstallment']);
  const activityRepository = jasmine.createSpyObj('ActivityRepositoryService', ['getProjectActivity']);
  const deliveryService = jasmine.createSpyObj('PaymentDeliveryService', ['getProjectDeliveries','setReminderControl','retry','sendInstallmentPaymentEmail']);
  const documentRepository = jasmine.createSpyObj('ProjectProposalDocumentVersionRepositoryService', ['getProjectDocumentVersions']);
  const snapshotRepository = jasmine.createSpyObj('ProjectProposalInvoiceSnapshotRepositoryService', ['getProjectSnapshots']);
  const projectRepository = jasmine.createSpyObj('ProjectRepositoryService', ['getProjectById', 'cascadeDeleteProjectTestData']);
  const leadRepository = jasmine.createSpyObj('LeadRepositoryService', ['getLeadById']);
  const router = jasmine.createSpyObj('Router', ['navigate']);
  const toast = jasmine.createSpyObj('ToastService', ['showToast']);
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
    paymentRepository.createRevisionInstallment.and.resolveTo();
    paymentRepository.getProjectFinancialSummary.and.resolveTo({available:true,proposalTotal:106,depositTarget:31.8,finalTarget:74.2,creditedPrincipal:0,outstanding:106,customerFees:0,merchantFees:0,overpayment:0,obligations:[],needsAttention:[]});
    activityRepository.getProjectActivity.and.resolveTo([]);deliveryService.getProjectDeliveries.and.resolveTo([]);deliveryService.setReminderControl.and.resolveTo();deliveryService.retry.and.resolveTo({} as any);documentRepository.getProjectDocumentVersions.and.resolveTo([]);snapshotRepository.getProjectSnapshots.and.resolveTo([]);
    projectRepository.cascadeDeleteProjectTestData.and.resolveTo({
      projectId: 'project-1', projectName: 'Wedding', deletedSourceLead: true,
      deletedContacts: 1, deletedOrganizations: 0, deletedPaymentTransactions: 2,
      deletedPaymentRecords: 2, storageObjects: [], storageCleanupFailures: 0,
    });
    projectRepository.getProjectById.and.resolveTo(project);
    leadRepository.getLeadById.and.resolveTo(null);
    router.navigate.and.resolveTo(true);
    deliveryService.sendInstallmentPaymentEmail.and.resolveTo('sent');
    await TestBed.configureTestingModule({
      imports: [ProjectDetailsComponent],
      providers: [
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        { provide: Router, useValue: router },
        { provide: ProjectRepositoryService, useValue: projectRepository }, { provide: LeadRepositoryService, useValue: leadRepository },
        { provide: ProjectPaymentRecordRepositoryService, useValue: paymentRepository }, { provide: ActivityRepositoryService, useValue: activityRepository },
        { provide: ProjectProposalDocumentVersionRepositoryService, useValue: documentRepository },
        { provide: ProjectProposalInvoiceSnapshotRepositoryService, useValue: snapshotRepository },
        { provide: ProjectWorkflowService, useValue: workflowService }, { provide: SupabaseService, useValue: {} },
        { provide: PaymentDeliveryService, useValue: deliveryService },
        { provide: ProjectProposalRevisionService, useValue: resolver },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(ProjectDetailsComponent);
    component = fixture.componentInstance;
    component.project.set(project);
  });

  it('renders one fluid CRM shell with a responsive split view and contained payment table', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    component.payments.set([{
      project_payment_record_id: 'deposit',
      project_id: 'project-1',
      payment_kind: 'deposit',
      status: 'due',
      target_amount: 30,
      credited_principal: 0,
      outstanding_amount: 30,
    } as any]);
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    const shells = root.querySelectorAll('[data-crm-page-shell]');
    const splitView = root.querySelector('.xl\\:grid-cols-\\[minmax\\(0\\,1fr\\)_420px\\]');
    const paymentTable = root.querySelector('table.crm-table');

    expect(shells.length).toBe(1);
    expect(shells[0].classList).toContain('crm-page-frame');
    expect(splitView).not.toBeNull();
    expect(paymentTable?.parentElement?.classList).toContain('overflow-x-auto');
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

  it('keeps zero-dollar installments visible as Not Required and ineligible', () => {
    const payment:any={status:'not_due',displayStatus:'not_required',target_amount:0,outstanding_amount:0};
    expect(component.paymentStatus(payment)).toBe('Not Required');
    expect(component.canRecordPayment(payment)).toBeFalse();
  });

  it('can schedule the $1,290 increase while preserving the $3,210 already paid', async () => {
    component.snapshots.set([
      { ...snapshot, project_proposal_invoice_snapshot_id: 'snapshot-1', version: 1, total_amount: 3210, is_active: false },
      { ...snapshot, total_amount: 4500 },
    ]);
    component.payments.set([
      { project_payment_record_id: 'deposit', payment_kind: 'deposit', status: 'paid', target_amount: 963, credited_principal: 963, outstanding_amount: 0 } as any,
      { project_payment_record_id: 'final', payment_kind: 'final_payment', status: 'partially_paid', target_amount: 3537, credited_principal: 2247, outstanding_amount: 1290 } as any,
    ]);
    expect(component.revisionInstallmentAvailable()).toBe(1290);
    component.project.set({ ...project, status: 'completed' });
    expect(component.canCreateRevisionInstallment()).toBeFalse();
    component.project.set(project);
    component.openInstallmentModal();
    expect(component.installmentAmount()).toBe('1290.00');
    component.installmentDueDate.set('2099-01-01');
    await component.createRevisionInstallment();
    expect(paymentRepository.createRevisionInstallment).toHaveBeenCalledWith('project-1', 129000, '2099-01-01');
    expect(component.installmentModalOpen()).toBeFalse();
  });

  it('does not offer a second installment once the revision increase is scheduled', () => {
    component.snapshots.set([
      { ...snapshot, project_proposal_invoice_snapshot_id: 'snapshot-1', version: 1, total_amount: 3210, is_active: false },
      { ...snapshot, total_amount: 4500 },
    ]);
    component.payments.set([
      { project_payment_record_id: 'final', payment_kind: 'final_payment', status: 'paid', target_amount: 2247, credited_principal: 2247, outstanding_amount: 0 } as any,
      { project_payment_record_id: 'revision', payment_kind: 'revision_balance', status: 'due', target_amount: 1290, outstanding_amount: 1290, origin_snapshot_id: 'snapshot-2' } as any,
    ]);
    expect(component.canCreateRevisionInstallment()).toBeFalse();
  });

  it('shows no further action for a paid installment with no outstanding balance', async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    component.payments.set([{
      project_payment_record_id: 'deposit', project_id: 'project-1', payment_kind: 'deposit',
      status: 'paid', target_amount: 30, credited_principal: 30, outstanding_amount: 0,
      reminder_enabled: true,
    } as any]);
    fixture.detectChanges();

    const actions = (fixture.nativeElement as HTMLElement).querySelector('.installment-row td:last-child');
    expect(actions?.textContent?.trim()).toBe('No Further Action');
    expect(actions?.querySelector('button')).toBeNull();
    expect(component.isInstallmentSettled({ status: 'paid', outstanding_amount: 1 } as any)).toBeFalse();
  });

  it('uses an audited obligation reminder command without changing financial state locally', async () => {
    spyOn(window,'prompt').and.returnValue('Customer requested pause');
    const payment:any={project_payment_record_id:'deposit',project_id:'project-1',reminder_enabled:true};
    await component.toggleReminder(payment);
    expect(deliveryService.setReminderControl).toHaveBeenCalledWith('project-1','deposit',false,null,'Customer requested pause');
  });

  it('offers a payment email beside Record Payment and requests only that installment balance', async () => {
    deliveryService.sendInstallmentPaymentEmail.calls.reset();
    const deposit = {
      project_payment_record_id: 'deposit-1', project_id: 'project-1',
      payment_kind: 'deposit', status: 'partially_paid', target_amount: 50,
      credited_principal: 18.2, outstanding_amount: 31.8,
    } as any;
    fixture.detectChanges();
    await fixture.whenStable();
    component.payments.set([deposit]);
    fixture.detectChanges();
    const actions = (fixture.nativeElement as HTMLElement).querySelector('.installment-row td:last-child');
    expect(actions?.textContent).toContain('Record Payment');
    expect(actions?.textContent).toContain('Send Payment Email');
    expect(actions?.querySelectorAll('button')[1]?.textContent?.trim()).toBe('Send Payment Email');

    await component.sendPaymentEmail(deposit);

    expect(deliveryService.sendInstallmentPaymentEmail).toHaveBeenCalledOnceWith('deposit-1', 3180);
    expect(toast.showToast).toHaveBeenCalledWith('The installment payment email was sent.');
  });

  it('targets a revised installment and blocks settled or review-required balances', async () => {
    deliveryService.sendInstallmentPaymentEmail.calls.reset();
    const revision = {
      project_payment_record_id: 'revision-1', project_id: 'project-1',
      payment_kind: 'revision_balance', status: 'due', target_amount: 1290,
      credited_principal: 0, outstanding_amount: 1290,
    } as any;
    component.payments.set([revision]);
    expect(component.canSendPaymentEmail(revision)).toBeTrue();
    expect(component.canSendPaymentEmail({ ...revision, status: 'paid', outstanding_amount: 0 })).toBeFalse();
    expect(component.canSendPaymentEmail({ ...revision, status: 'review_required' })).toBeFalse();

    await component.sendPaymentEmail(revision);

    expect(deliveryService.sendInstallmentPaymentEmail).toHaveBeenCalledOnceWith('revision-1', 129000);
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
    expect(toast.showToast).toHaveBeenCalledWith(
      'Project "Wedding" and all associated payment data were permanently deleted.'
    );
    expect(router.navigate).toHaveBeenCalledWith(['/admin/projects']);
  });
});
