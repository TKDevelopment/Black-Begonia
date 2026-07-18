import { ProjectActivityPanelComponent } from './project-activity-panel.component';

describe('ProjectActivityPanelComponent', () => {
  const activity = { activity_log_id: 'a1', entity_type: 'project', entity_id: 'p1', activity_type: 'proposal_revision_submitted', activity_label: 'Revision submitted', created_at: '2026-01-01T00:00:00Z' } as const;

  it('uses display name, then email, then Unknown user for revision attribution', () => {
    const component = new ProjectActivityPanelComponent();
    expect(component.actorName({ ...activity, performed_by_display_name: 'Florist', performed_by_email: 'owner@example.com' })).toBe('Florist');
    expect(component.actorName({ ...activity, performed_by_email: 'owner@example.com' })).toBe('owner@example.com');
    expect(component.actorName(activity)).toBe('Unknown user');
  });

  it('does not expose submission keys or internal record ids in visible metadata', () => {
    const component = new ProjectActivityPanelComponent();
    const entries = component.metadataEntries({ ...activity, metadata: {
      new_version: 3, submission_idempotency_key: 'secret-key', new_snapshot_id: 'snapshot-id', new_document_id: 'document-id',
    } });
    expect(entries).toEqual([{ key: 'New Version', value: '3' }]);
  });
});
