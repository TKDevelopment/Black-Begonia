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

  it('keeps header content fluid while retaining the intentional subtitle measure', () => {
    component.subtitle = 'Readable supporting copy';
    fixture.detectChanges();
    const root = fixture.nativeElement.querySelector('.crm-page-header-root') as HTMLElement;
    const subtitle = fixture.nativeElement.querySelector('.crm-page-header-subtitle') as HTMLElement;

    expect(root.classList).toContain('lg:flex-row');
    expect(subtitle.classList).toContain('max-w-3xl');
  });
});
