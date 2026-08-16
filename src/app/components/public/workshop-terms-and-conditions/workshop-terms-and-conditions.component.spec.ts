import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';

import { SeoService } from '../../../core/seo/seo.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';
import { publicWorkshopOccurrenceFixture } from '../../../core/testing/workshop-testing';
import { WorkshopTermsAndConditionsComponent } from './workshop-terms-and-conditions.component';

describe('WorkshopTermsAndConditionsComponent', () => {
  let fixture: ComponentFixture<WorkshopTermsAndConditionsComponent>;
  const repository = jasmine.createSpyObj<WorkshopPublicRepositoryService>(
    'WorkshopPublicRepositoryService', ['getByRoute'],
  );
  const seo = jasmine.createSpyObj<SeoService>('SeoService', ['setPageMeta']);

  beforeEach(async () => {
    repository.getByRoute.and.resolveTo(publicWorkshopOccurrenceFixture({
      terms: 'Reservation and payment\nPayment is required to reserve seats.\n\nCustomer cancellations\nCancellations are subject to the stated policy.',
      termsVersion: 4,
    }));
    await TestBed.configureTestingModule({
      imports: [WorkshopTermsAndConditionsComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(new Map([
            ['seriesSlug', 'summer-garden-centerpiece'],
            ['workshopDate', '2026-08-15'],
          ])) },
        },
        { provide: WorkshopPublicRepositoryService, useValue: repository },
        { provide: SeoService, useValue: seo },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(WorkshopTermsAndConditionsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  });

  it('shows the exact occurrence terms in a policy-style panel', () => {
    expect(repository.getByRoute).toHaveBeenCalledWith(
      'summer-garden-centerpiece', '2026-08-15',
    );
    expect(fixture.nativeElement.querySelector('.workshop-terms-page')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.terms-panel')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Workshop Terms & Conditions');
    expect(fixture.nativeElement.textContent).toContain('Terms version 4');
    expect(fixture.nativeElement.textContent).toContain('Payment is required');
    expect(fixture.nativeElement.querySelectorAll('.term-clause h3').length).toBe(2);
    expect(fixture.nativeElement.querySelector('.term-clause h3').textContent)
      .toContain('Reservation and payment');
    expect(fixture.nativeElement.querySelector('.back-link').getAttribute('href'))
      .toBe('/workshops/summer-garden-centerpiece/2026-08-15/reserve');
    expect(seo.setPageMeta).toHaveBeenCalledWith(jasmine.objectContaining({
      robots: 'noindex,nofollow',
    }));
    expect(getComputedStyle(fixture.nativeElement.querySelector('.workshop-terms-page')).backgroundImage)
      .toContain('FizzFritesLadyFingerLounge_Apr3_KCP208.jpg');
  });
});
