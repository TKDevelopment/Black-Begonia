import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectContactsPanelComponent } from './project-contacts-panel.component';

describe('ProjectContactsPanelComponent', () => {
  let component: ProjectContactsPanelComponent;
  let fixture: ComponentFixture<ProjectContactsPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectContactsPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectContactsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
