import { TestBed } from '@angular/core/testing';
import { ProjectActivityPanelComponent } from './project-activity-panel.component';

describe('ProjectActivityPanelComponent', () => {
  const activity = { activity_log_id: 'a1', entity_type: 'project', entity_id: 'p1', activity_type: 'proposal_revision_submitted', activity_label: 'Revision submitted', created_at: '2026-01-01T00:00:00Z' } as const;

  it('uses display name, email, actor type, then System for attribution', () => {
    const component = new ProjectActivityPanelComponent();
    expect(component.actorName({ ...activity, performed_by_display_name: 'Florist', performed_by_email: 'owner@example.com' })).toBe('Florist');
    expect(component.actorName({ ...activity, performed_by_email: 'owner@example.com' })).toBe('owner@example.com');
    expect(component.actorName({ ...activity, actor_type: 'provider' })).toBe('Provider');
    expect(component.actorName(activity)).toBe('System');
  });

  it('renders only concise florist-useful metadata and formats payment amounts', () => {
    const component = new ProjectActivityPanelComponent();
    const entries = component.metadataEntries({ ...activity, actor_type:'schedule', payment_reference:'BBP-2026-1', metadata:{payment_reference:'BBP-2026-1',method:'stripe',principal_amount:125.5,token_digest:'secret',raw_payload:{secret:true},provider_client_token:'secret'} });
    expect(entries).toEqual([{key:'Method',value:'Stripe'},{key:'Principal Amount',value:'$125.50'}]);
  });

  it('does not expose submission keys or internal record ids in visible metadata', () => {
    const component = new ProjectActivityPanelComponent();
    const entries = component.metadataEntries({ ...activity, metadata: {
      new_version: 3, submission_idempotency_key: 'secret-key', new_snapshot_id: 'snapshot-id', new_document_id: 'document-id',
    } });
    expect(entries).toEqual([{ key: 'New Version', value: '3' }]);
  });

  it('uses readable singular and plural activity counts', () => {
    const component = new ProjectActivityPanelComponent();
    component.activities = [activity];
    expect(component.activityCountLabel()).toBe('1 update');
    component.activities = [activity, { ...activity, activity_log_id: 'a2' }];
    expect(component.activityCountLabel()).toBe('2 updates');
  });

  it('shows payment email and recorded payment activity without delivery badges or references', async () => {
    await TestBed.configureTestingModule({ imports: [ProjectActivityPanelComponent] }).compileComponents();
    const fixture = TestBed.createComponent(ProjectActivityPanelComponent);
    fixture.componentInstance.activities = [
      {
        ...activity, activity_log_id: 'email', activity_type: 'payment_recorded', activity_label: 'Payment email accepted',
        description: 'The payment email provider accepted the message.',
        metadata: { outcome: 'accepted', delivery_kind: 'initial_request' },
      },
      {
        ...activity, activity_log_id: 'payment', activity_type: 'payment_recorded', activity_label: 'Payment recorded',
        description: 'Deposit payment BBP-2026-0001 was recorded.',
        payment_reference: 'BBP-2026-0001',
        metadata: { payment_reference: 'BBP-2026-0001', payment_kind: 'deposit' },
      },
    ];
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Payment email sent');
    expect(text).toContain('Mailgun has successfully sent the payment email to the client.');
    expect(text).toContain('Deposit payment was recorded.');
    expect(text).not.toContain('BBP-2026-0001');
    expect(text).not.toContain('Delivery Kind');
    expect(text).not.toContain('Outcome');
  });
});
