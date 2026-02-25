import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DeclineProposalComponent } from './decline-proposal.component';

describe('DeclineProposalComponent', () => {
  let component: DeclineProposalComponent;
  let fixture: ComponentFixture<DeclineProposalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeclineProposalComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DeclineProposalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
