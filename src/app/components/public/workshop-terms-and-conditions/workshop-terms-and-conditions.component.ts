import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterModule } from '@angular/router';

import { PublicWorkshopOccurrence } from '../../../core/models/workshop';
import { SeoService } from '../../../core/seo/seo.service';
import { WorkshopPublicRepositoryService } from '../../../core/supabase/repositories/workshop-public-repository.service';

@Component({
  selector: 'app-workshop-terms-and-conditions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './workshop-terms-and-conditions.component.html',
  styleUrl: './workshop-terms-and-conditions.component.scss',
})
export class WorkshopTermsAndConditionsComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly repository = inject(WorkshopPublicRepositoryService);
  private readonly seo = inject(SeoService);

  readonly workshop = signal<PublicWorkshopOccurrence | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly termsClauses = computed(() => {
    const terms = this.workshop()?.terms.trim();
    if (!terms) return [];
    return terms.split(/\n\s*\n/).map((block) => {
      const [firstLine, ...bodyLines] = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      return bodyLines.length
        ? { title: firstLine, body: bodyLines.join('\n') }
        : { title: null, body: firstLine };
    });
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => void this.load(
      params.get('seriesSlug') ?? '',
      params.get('workshopDate') ?? '',
    ));
  }

  async load(seriesSlug: string, workshopDate: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const workshop = seriesSlug && workshopDate
        ? await this.repository.getByRoute(seriesSlug, workshopDate)
        : null;
      if (!workshop) {
        this.error.set('These workshop terms are unavailable.');
        return;
      }
      this.workshop.set(workshop);
      this.seo.setPageMeta({
        title: `Workshop Terms & Conditions | ${workshop.title}`,
        description: `Booking terms and conditions for ${workshop.title}.`,
        image: workshop.heroImageUrl,
        url: `https://blackbegoniaflorals.com/workshops/${seriesSlug}/${workshopDate}/terms-and-conditions`,
        robots: 'noindex,nofollow',
      });
    } catch {
      this.error.set('These workshop terms could not be loaded right now.');
    } finally {
      this.loading.set(false);
    }
  }

  formatUpdated(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
      month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/New_York',
    }).format(new Date(value));
  }
}
