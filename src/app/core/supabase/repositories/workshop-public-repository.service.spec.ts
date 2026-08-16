import { TestBed } from '@angular/core/testing';

import {
  publicWorkshopOccurrenceFixture,
  publicWorkshopSummaryFixture,
} from '../../testing/workshop-testing';
import { SupabaseService } from '../clients/supabase.service';
import { WorkshopPublicRepositoryService } from './workshop-public-repository.service';

describe('WorkshopPublicRepositoryService', () => {
  let service: WorkshopPublicRepositoryService;
  let rpc: jasmine.Spy;

  beforeEach(() => {
    rpc = jasmine.createSpy('rpc');
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue({ rpc } as never);
    TestBed.configureTestingModule({
      providers: [
        WorkshopPublicRepositoryService,
        { provide: SupabaseService, useValue: supabase },
      ],
    });
    service = TestBed.inject(WorkshopPublicRepositoryService);
  });

  it('maps the minimized anonymous listing projection', async () => {
    const summary = publicWorkshopSummaryFixture();
    rpc.and.resolveTo({ data: [summary], error: null });
    await expectAsync(service.listUpcoming()).toBeResolvedTo([summary]);
    expect(rpc).toHaveBeenCalledWith('get_public_workshop_listing');
  });

  it('maps detail, not-found, and retained redirect outcomes', async () => {
    const detail = publicWorkshopOccurrenceFixture({
      seoStatus: 'redirect',
      redirectUrl: '/workshops',
    });
    rpc.and.resolveTo({ data: detail, error: null });
    await expectAsync(service.getBySlug(detail.slug)).toBeResolvedTo(detail);

    rpc.and.resolveTo({ data: null, error: null });
    await expectAsync(service.getBySlug('missing')).toBeResolvedTo(null);
  });

  it('resolves a public occurrence by workshop title and local date route', async () => {
    const detail = publicWorkshopOccurrenceFixture();
    rpc.and.resolveTo({ data: detail, error: null });

    await expectAsync(service.getByRoute(detail.seriesSlug, detail.workshopDate))
      .toBeResolvedTo(detail);
    expect(rpc).toHaveBeenCalledWith('get_public_workshop_occurrence_route', {
      p_series_slug: 'summer-garden-centerpiece',
      p_workshop_date: '2026-08-15',
    });
  });

  it('does not rewrite safe projection failures', async () => {
    const error = { message: 'projection unavailable' };
    rpc.and.resolveTo({ data: null, error });
    await expectAsync(service.listUpcoming()).toBeRejectedWith(error);
  });
});
