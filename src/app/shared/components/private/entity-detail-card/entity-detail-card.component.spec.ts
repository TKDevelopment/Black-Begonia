import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityDetailCardComponent } from './entity-detail-card.component';

describe('EntityDetailCardComponent', () => {
  let component: EntityDetailCardComponent;
  let fixture: ComponentFixture<EntityDetailCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityDetailCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityDetailCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
