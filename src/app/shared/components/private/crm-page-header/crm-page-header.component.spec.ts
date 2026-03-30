import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CrmPageHeaderComponent } from './crm-page-header.component';

describe('CrmPageHeaderComponent', () => {
  let component: CrmPageHeaderComponent;
  let fixture: ComponentFixture<CrmPageHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CrmPageHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CrmPageHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
