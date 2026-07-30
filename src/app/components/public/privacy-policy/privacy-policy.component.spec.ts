import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PrivacyPolicyComponent } from './privacy-policy.component';
import { SeoService } from '../../../core/seo/seo.service';

describe('PrivacyPolicyComponent', () => {
  let component: PrivacyPolicyComponent;
  let fixture: ComponentFixture<PrivacyPolicyComponent>;
  const seo = jasmine.createSpyObj<SeoService>('SeoService', ['setPageMeta']);

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PrivacyPolicyComponent],
      providers: [{ provide: SeoService, useValue: seo }],
    })
    .compileComponents();

    fixture = TestBed.createComponent(PrivacyPolicyComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('discloses analytics choices, exclusions, Google, and retention', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Google Analytics 4');
    expect(text).toContain('Global Privacy Control');
    expect(text).toContain('CRM and administrator pages');
    expect(text).toContain('14 months');
  });

  it('presents the policy in a readable panel over the public floral background', () => {
    const page = fixture.nativeElement.querySelector('.privacy-page') as HTMLElement;
    const panel = fixture.nativeElement.querySelector('.policy-panel') as HTMLElement;

    expect(page).toBeTruthy();
    expect(panel).toBeTruthy();
  });
});
