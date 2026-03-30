import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EntityTableShellComponent } from './entity-table-shell.component';

describe('EntityTableShellComponent', () => {
  let component: EntityTableShellComponent;
  let fixture: ComponentFixture<EntityTableShellComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityTableShellComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EntityTableShellComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
