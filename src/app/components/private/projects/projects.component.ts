import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';

import { Project } from '../../../core/models/project';
import { ProjectProposalDocumentVersion } from '../../../core/models/project-proposal-document-version';
import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { ProjectProposalDocumentVersionRepositoryService } from '../../../core/supabase/repositories/project-proposal-document-version-repository.service';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';
import { CrmPageHeaderComponent } from '../../../shared/components/private/crm-page-header/crm-page-header.component';
import { LoadingStateBlockComponent } from '../../../shared/components/private/loading-state-block/loading-state-block.component';
import { ErrorStateBlockComponent } from '../../../shared/components/private/error-state-block/error-state-block.component';
import { StatusBadgeComponent } from '../../../shared/components/private/status-badge/status-badge.component';
import { formatDateOnlyForDisplay } from '../../../core/utils/date-only';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [
    CommonModule,
    CrmPageHeaderComponent,
    LoadingStateBlockComponent,
    ErrorStateBlockComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './projects.component.html',
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly projectRepository = inject(ProjectRepositoryService);
  private readonly documentVersionRepository = inject(ProjectProposalDocumentVersionRepositoryService);
  private readonly supabaseService = inject(SupabaseService);

  readonly loading = signal(true);
  readonly documentLoading = signal(false);
  readonly error = signal<string | null>(null);
  readonly projects = signal<Project[]>([]);
  readonly selectedProjectId = signal<string | null>(null);
  readonly documentVersions = signal<ProjectProposalDocumentVersion[]>([]);

  readonly selectedProject = computed(() => {
    const selectedId = this.selectedProjectId();
    return this.projects().find((project) => project.project_id === selectedId) ?? this.projects()[0] ?? null;
  });

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const projects = await this.projectRepository.getProjects();
      this.projects.set(projects);
      const routeProjectId =
        this.route.snapshot.paramMap.get('projectId') ??
        this.route.snapshot.queryParamMap.get('projectId') ??
        projects[0]?.project_id ??
        null;
      this.selectedProjectId.set(routeProjectId);

      if (routeProjectId) {
        await this.loadDocumentVersions(routeProjectId);
      }
    } catch (error) {
      console.error('[ProjectsComponent] loadProjects error:', error);
      this.error.set('We could not load projects right now.');
    } finally {
      this.loading.set(false);
    }
  }

  async selectProject(projectId: string): Promise<void> {
    this.selectedProjectId.set(projectId);
    await this.router.navigate(['/admin/projects', projectId]);
    await this.loadDocumentVersions(projectId);
  }

  async loadDocumentVersions(projectId: string): Promise<void> {
    this.documentLoading.set(true);

    try {
      this.documentVersions.set(
        await this.documentVersionRepository.getProjectDocumentVersions(projectId)
      );
    } catch (error) {
      console.error('[ProjectsComponent] loadDocumentVersions error:', error);
      this.error.set('We could not load proposal document history right now.');
    } finally {
      this.documentLoading.set(false);
    }
  }

  async openDocument(version: ProjectProposalDocumentVersion): Promise<void> {
    const { data, error } = await this.supabaseService
      .getClient()
      .storage
      .from(version.storage_bucket)
      .createSignedUrl(version.storage_path, 60 * 10);

    if (error || !data?.signedUrl) {
      this.error.set('We could not open this proposal document right now.');
      return;
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  reviseProposal(project: Project): void {
    if (!project.source_lead_id) {
      this.error.set('This project is not linked to a source lead proposal builder.');
      return;
    }

    void this.router.navigate(
      ['/admin/leads', project.source_lead_id, 'floral-proposal-builder'],
      { queryParams: { projectId: project.project_id } }
    );
  }

  formatDate(value: string | null | undefined): string {
    return formatDateOnlyForDisplay(value, 'No date set', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return 'Not recorded';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(value));
  }

  formatCurrency(value: number | null | undefined): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value ?? 0);
  }
}
