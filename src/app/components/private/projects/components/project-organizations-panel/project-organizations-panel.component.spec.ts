import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectOrganizationsPanelComponent } from './project-organizations-panel.component';

describe('ProjectOrganizationsPanelComponent', () => {
  let component: ProjectOrganizationsPanelComponent;
  let fixture: ComponentFixture<ProjectOrganizationsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectOrganizationsPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectOrganizationsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
