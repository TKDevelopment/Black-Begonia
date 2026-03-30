import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseService } from '../../../core/supabase/clients/supabase.service';

interface PortfolioGalleryRow {
  gallery_id: string;
  slug: string;
  couple_names: string;
  venue: string;
  event_date: string | null;
  cover_image_url: string | null;
  hero_image_url: string | null;
  description: string | null;
  is_featured: boolean;
  is_active: boolean;
  created_at: string;
}

interface PortfolioGallery {
  galleryId: string;
  slug: string;
  coupleNames: string;
  venue: string;
  eventDate: string | null;
  coverImage: string;
  heroImage: string | null;
  description: string | null;
  isFeatured: boolean;
  position: 'left' | 'center' | 'right';
}

interface PortfolioCtaBlock {
  quote: string;
  reviewer: string;
  align: 'left' | 'right';
  heading: string;
  subheading: string;
  buttonText: string;
  buttonLink: string;
}

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
  templateUrl: './portfolio.component.html',
  styleUrl: './portfolio.component.scss'
})
export class PortfolioComponent implements OnInit {
  loading = true;
  errorMessage = '';
  galleries: PortfolioGallery[] = [];
  heroImage = 'assets/images/weddings/Fizz-Frites/FizzFritesLadyFingerLounge_Apr3_KCP208.jpg';
  navigatingSlug: string | null = null;
  isMobileOrSmall = false;

  constructor(
    private supabase: SupabaseService,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    this.updateScreenMode();
    await this.loadGalleries();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateScreenMode();
  }

  onGalleryClick(slug: string): void {
    if (this.navigatingSlug) {
      return;
    }

    this.navigatingSlug = slug;

    setTimeout(() => {
      this.router.navigate(['/portfolio', slug]);
    }, 2000);
  }

  async loadGalleries(): Promise<void> {
    this.loading = true;
    this.errorMessage = '';

    try {
      const { data, error } = await this.supabase.getClient()
        .from('portfolio_galleries')
        .select(`
          gallery_id,
          slug,
          couple_names,
          venue,
          event_date,
          cover_image_url,
          hero_image_url,
          description,
          is_featured,
          is_active,
          created_at
        `)
        .eq('is_active', true)
        .order('view_order', { ascending: true, nullsFirst: false });

      if (error) {
        throw error;
      }

      const rows = (data ?? []) as PortfolioGalleryRow[];

      this.galleries = rows.map((row, index) => ({
        galleryId: row.gallery_id,
        slug: row.slug,
        coupleNames: row.couple_names,
        venue: row.venue,
        eventDate: row.event_date,
        coverImage: row.cover_image_url || '',
        heroImage: row.hero_image_url,
        description: row.description,
        isFeatured: row.is_featured,
        position: this.getPosition(index)
      }));

      const featuredGallery =
        rows.find(g => g.is_featured && g.hero_image_url) ||
        rows.find(g => g.hero_image_url);

      if (featuredGallery?.hero_image_url) {
        this.heroImage = featuredGallery.hero_image_url;
      }
    } catch (error) {
      console.error('Error loading portfolio galleries:', error);
      this.errorMessage = 'Unable to load portfolio galleries right now.';
    } finally {
      this.loading = false;
    }
  }

  getPosition(index: number): 'left' | 'center' | 'right' {
    const pattern: Array<'left' | 'center' | 'right'> = ['right', 'center', 'left'];
    return pattern[index % pattern.length];
  }

  getDisplayPosition(gallery: PortfolioGallery): 'left' | 'center' | 'right' {
    return this.isMobileOrSmall ? 'center' : gallery.position;
  }

  get galleryChunks(): PortfolioGallery[][] {
    const size = 6;
    const chunks: PortfolioGallery[][] = [];

    for (let i = 0; i < this.galleries.length; i += size) {
      chunks.push(this.galleries.slice(i, i + size));
    }

    return chunks;
  }

  trackByGallery(index: number, gallery: PortfolioGallery): string {
    return gallery.galleryId;
  }

  private updateScreenMode(): void {
    this.isMobileOrSmall = window.innerWidth < 768;
  }
}