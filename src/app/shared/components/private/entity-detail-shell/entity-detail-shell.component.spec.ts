import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityDetailShellComponent } from './entity-detail-shell.component';

describe('EntityDetailShellComponent', () => {
  let component: EntityDetailShellComponent;
  let fixture: ComponentFixture<EntityDetailShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityDetailShellComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityDetailShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
