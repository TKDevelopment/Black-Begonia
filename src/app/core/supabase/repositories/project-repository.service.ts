import { Injectable } from '@angular/core';
import { CreateProjectInput, Project, UpdateProjectInput } from '../../models/project';
import { SupabaseService } from '../clients/supabase.service';

export interface ProjectCascadeDeleteResult {
  projectId: string;
  projectName: string;
  deletedSourceLead: boolean;
  deletedContacts: number;
  deletedOrganizations: number;
  storageObjects: Array<{ bucket: string; path: string }>;
  storageCleanupFailures: number;
}

@Injectable({
  providedIn: 'root',
})
export class ProjectRepositoryService {
  constructor(private supabaseService: SupabaseService) {}

  get client() {
    return this.supabaseService.getClient();
  }

  private readonly projectSelect = `
    project_id,
    project_name,
    service_type,
    event_type,
    event_date,
    ceremony_venue_name,
    ceremony_venue_city,
    ceremony_venue_state,
    ceremony_venue_address,
    ceremony_venue_zipcode,
    reception_venue_name,
    reception_venue_city,
    reception_venue_state,
    reception_venue_address,
    reception_venue_zipcode,
    budget_range,
    guest_count,
    style_notes,
    internal_notes,
    status,
    source_lead_id,
    primary_contact_id,
    assigned_user_id,
    active_proposal_invoice_snapshot_id,
    active_proposal_document_version_id,
    booked_at,
    completed_at,
    canceled_at,
    created_at,
    updated_at
  `;

  async getProjects(): Promise<Project[]> {
    await this.refreshProjectPaymentStatuses();

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .select(this.projectSelect)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[ProjectRepositoryService] getProjects error:', error);
      return [];
    }

    return (data ?? []) as Project[];
  }

  async getProjectById(projectId: string): Promise<Project | null> {
    await this.refreshProjectPaymentStatuses(projectId);

    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .select(this.projectSelect)
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[ProjectRepositoryService] getProjectById error:', error);
      return null;
    }

    return (data as Project | null) ?? null;
  }

  async createProject(payload: CreateProjectInput): Promise<Project> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .insert({
        project_name: payload.project_name.trim(),
        service_type: payload.service_type,
        event_type: payload.event_type ?? null,
        event_date: payload.event_date ?? null,
        ceremony_venue_name: payload.ceremony_venue_name?.trim() || null,
        ceremony_venue_city: payload.ceremony_venue_city?.trim() || null,
        ceremony_venue_state: payload.ceremony_venue_state?.trim() || null,
        ceremony_venue_address: payload.ceremony_venue_address?.trim() || null,
        ceremony_venue_zipcode: payload.ceremony_venue_zipcode?.trim() || null,
        reception_venue_name: payload.reception_venue_name?.trim() || null,
        reception_venue_city: payload.reception_venue_city?.trim() || null,
        reception_venue_state: payload.reception_venue_state?.trim() || null,
        reception_venue_address: payload.reception_venue_address?.trim() || null,
        reception_venue_zipcode: payload.reception_venue_zipcode?.trim() || null,
        budget_range: payload.budget_range?.trim() || null,
        guest_count: payload.guest_count ?? null,
        style_notes: payload.style_notes?.trim() || null,
        internal_notes: payload.internal_notes?.trim() || null,
        status: payload.status ?? 'awaiting_deposit',
        source_lead_id: payload.source_lead_id ?? null,
        primary_contact_id: payload.primary_contact_id ?? null,
        assigned_user_id: payload.assigned_user_id ?? null,
        active_proposal_invoice_snapshot_id:
          payload.active_proposal_invoice_snapshot_id ?? null,
        active_proposal_document_version_id:
          payload.active_proposal_document_version_id ?? null,
      })
      .select(this.projectSelect)
      .single();

    if (error) {
      console.error('[ProjectRepositoryService] createProject error:', error);
      throw error;
    }

    return data as Project;
  }

  async updateProject(
    projectId: string,
    updates: UpdateProjectInput
  ): Promise<Project> {
    const safeUpdates = this.toSafeUpdatePayload(updates);
    const { data, error } = await this.supabaseService
      .getClient()
      .from('projects')
      .update({
        ...safeUpdates,
        updated_at: new Date().toISOString(),
      })
      .eq('project_id', projectId)
      .select(this.projectSelect)
      .single();

    if (error) {
      console.error('[ProjectRepositoryService] updateProject error:', error);
      throw error;
    }

    return data as Project;
  }

  async refreshProjectPaymentStatuses(projectId?: string): Promise<void> {
    const client = this.supabaseService.getClient();
    const { error } = await client.rpc('refresh_project_payment_statuses', {
      target_project_id: projectId ?? null,
    });

    if (error) {
      console.error('[ProjectRepositoryService] refreshProjectPaymentStatuses error:', error);
    }
  }

  async cascadeDeleteProjectTestData(
    projectId: string,
    confirmation: string
  ): Promise<ProjectCascadeDeleteResult> {
    const client = this.supabaseService.getClient();
    const { data, error } = await client.rpc('cascade_delete_project_test_data', {
      p_project_id: projectId,
      p_confirmation: confirmation,
    });

    if (error) {
      console.error('[ProjectRepositoryService] cascadeDeleteProjectTestData error:', error);
      throw new Error(error.message || 'The project could not be deleted.');
    }

    const result = data as Omit<ProjectCascadeDeleteResult, 'storageCleanupFailures'>;
    const pathsByBucket = new Map<string, string[]>();
    for (const storageObject of result.storageObjects ?? []) {
      if (!storageObject.bucket || !storageObject.path) continue;
      const paths = pathsByBucket.get(storageObject.bucket) ?? [];
      paths.push(storageObject.path);
      pathsByBucket.set(storageObject.bucket, paths);
    }

    let storageCleanupFailures = 0;
    for (const [bucket, paths] of pathsByBucket) {
      const { error: storageError } = await client.storage.from(bucket).remove(paths);
      if (storageError) {
        console.error('[ProjectRepositoryService] project storage cleanup error:', storageError);
        storageCleanupFailures += paths.length;
      }
    }

    return { ...result, storageCleanupFailures };
  }

  private toSafeUpdatePayload(updates: UpdateProjectInput): UpdateProjectInput {
    const allowedKeys: (keyof UpdateProjectInput)[] = [
      'project_name',
      'service_type',
      'event_type',
      'event_date',
      'ceremony_venue_name',
      'ceremony_venue_city',
      'ceremony_venue_state',
      'ceremony_venue_address',
      'ceremony_venue_zipcode',
      'reception_venue_name',
      'reception_venue_city',
      'reception_venue_state',
      'reception_venue_address',
      'reception_venue_zipcode',
      'budget_range',
      'guest_count',
      'style_notes',
      'internal_notes',
      'status',
      'active_proposal_invoice_snapshot_id',
      'active_proposal_document_version_id',
      'booked_at',
      'completed_at',
      'canceled_at',
    ];

    return allowedKeys.reduce<UpdateProjectInput>((payload, key) => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        (payload as Record<string, unknown>)[key] = updates[key];
      }

      return payload;
    }, {});
  }
}
