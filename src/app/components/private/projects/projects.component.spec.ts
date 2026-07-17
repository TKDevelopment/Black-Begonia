import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';

import { ProjectRepositoryService } from '../../../core/supabase/repositories/project-repository.service';
import { testProject } from '../../../core/testing/workflow-fixtures';
import { ProjectsComponent } from './projects.component';

describe('ProjectsComponent', () => {
  let component: ProjectsComponent;
  let fixture: ComponentFixture<ProjectsComponent>;
  let projectRepository: jasmine.SpyObj<ProjectRepositoryService>;
  let router: jasmine.SpyObj<Router>;
  let consoleErrorSpy: jasmine.Spy;

  beforeEach(async () => {
    projectRepository = jasmine.createSpyObj<ProjectRepositoryService>(
      'ProjectRepositoryService',
      ['getProjects']
    );
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);

    projectRepository.getProjects.and.resolveTo([
      {
        ...testProject,
        status: 'awaiting_deposit',
        service_type: 'Full-Service Wedding',
        ceremony_venue_name: 'Test Garden',
      },
      {
        ...testProject,
        project_id: 'project-test-002',
        project_name: 'Corporate Gala',
        status: 'final_prep',
        service_type: 'Corporate Events',
        event_type: 'corporate',
        ceremony_venue_name: null,
        ceremony_venue_city: null,
        ceremony_venue_state: null,
        ceremony_venue_address: null,
        ceremony_venue_zipcode: null,
        reception_venue_name: null,
        reception_venue_city: null,
        reception_venue_state: null,
        reception_venue_address: null,
        reception_venue_zipcode: null,
      },
    ]);
    router.navigate.and.resolveTo(true);

    await TestBed.configureTestingModule({
      imports: [ProjectsComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ProjectRepositoryService, useValue: projectRepository },
      ],
    }).compileComponents();

    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads projects into the CRM table with required columns', async () => {
    createComponent();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.columns.map((column) => column.label)).toEqual([
      'Project',
      'Service Type',
      'Event Date',
      'Status',
      'Actions',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Avery and Jordan Wedding');
    expect(fixture.nativeElement.textContent).toContain('Awaiting Deposit');
  });

  it('searches broadly and filters by status, event type, and service type', async () => {
    createComponent();
    await fixture.whenStable();

    component.onSearchChange('garden');
    expect(component.filteredProjects().map((project) => project.project_id)).toEqual([
      testProject.project_id,
    ]);

    component.onSearchChange('');
    component.onFilterChange({ key: 'status', value: 'final_prep' });
    component.onFilterChange({ key: 'event_type', value: 'corporate' });
    component.onFilterChange({ key: 'service_type', value: 'Corporate Events' });

    expect(component.filteredProjects().map((project) => project.project_name)).toEqual([
      'Corporate Gala',
    ]);

    component.resetFilters();
    expect(component.filteredProjects().length).toBe(2);
  });

  it('navigates to the dedicated project details route from table actions', async () => {
    createComponent();
    await fixture.whenStable();

    component.openProject(testProject);

    expect(router.navigate).toHaveBeenCalledWith([
      '/admin/projects',
      testProject.project_id,
    ]);
  });

  it('shows a friendly error when projects cannot be loaded', async () => {
    const error = new Error('load failed');
    projectRepository.getProjects.and.rejectWith(error);

    createComponent();
    await fixture.whenStable();

    expect(component.error()).toBe('We could not load projects right now.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[ProjectsComponent] loadProjects error:',
      error
    );
  });

  function createComponent(): void {
    fixture = TestBed.createComponent(ProjectsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }
});
