import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProjectSummaryCardComponent } from './project-summary-card.component';

describe('ProjectSummaryCardComponent', () => {
  let component: ProjectSummaryCardComponent;
  let fixture: ComponentFixture<ProjectSummaryCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProjectSummaryCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProjectSummaryCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
