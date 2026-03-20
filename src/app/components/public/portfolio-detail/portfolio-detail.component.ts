import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, HostListener, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { SupabaseService } from '../../../services/supabase.service';

interface PortfolioImage {
  image_id: string;
  gallery_id: string;
  image_url: string;
  alt_text: string | null;
  view_order: number;
  is_visible: boolean;
  thumb_url: string;
  full_url: string;
  created_at: string;
}

interface PortfolioGalleryRecord {
  gallery_id: string;
  slug: string;
  couple_names: string;
  venue: string;
  cover_image_url: string;
  hero_image_url: string | null;
  description: string | null;
}

interface PortfolioGalleryImageViewModel {
  imageId: string;
  imageUrl: string;
  thumbUrl: string;
  fullUrl: string;
  altText: string;
  viewOrder: number;
}

interface PortfolioGalleryViewModel {
  slug: string;
  coupleNames: string;
  venue: string;
  coverImage: string;
  heroImage?: string;
  description?: string;
  images: PortfolioGalleryImageViewModel[];
}

@Component({
  selector: 'app-portfolio-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './portfolio-detail.component.html',
  styleUrl: './portfolio-detail.component.scss'
})
export class PortfolioDetailComponent implements OnInit {
  gallery?: PortfolioGalleryViewModel;
  loading = true;
  errorMessage = '';

  loadedImages: Record<string, boolean> = {};
  selectedImage: PortfolioGalleryImageViewModel | null = null;
  isDesktop = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit(): Promise<void> {
    this.updateScreenSize();

    this.route.paramMap.subscribe(async params => {
      const slug = params.get('slug');

      if (!slug) {
        this.router.navigate(['/portfolio']);
        return;
      }

      this.loading = true;

      const startTime = Date.now();

      await this.loadGallery(slug);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(1000 - elapsed, 0);

      setTimeout(() => {
        this.loading = false;
      }, remaining);
    });
  }

  @HostListener('window:resize')
  onResize(): void {
    this.updateScreenSize();

    if (!this.isDesktop && this.selectedImage) {
      this.closeImageModal();
    }
  }

  onImageLoad(imageKey: string): void {
    this.loadedImages[imageKey] = true;
  }

  openImageModal(image: PortfolioGalleryImageViewModel): void {
    if (!this.isDesktop) {
      return;
    }

    this.selectedImage = image;
    document.body.style.overflow = 'hidden';
  }

  closeImageModal(): void {
    this.selectedImage = null;
    document.body.style.overflow = '';
  }

  @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    if (this.selectedImage) {
      this.closeImageModal();
    }
  }

  private updateScreenSize(): void {
    this.isDesktop = window.innerWidth >= 768;
  }

  private async loadGallery(slug: string): Promise<void> {
    this.loading = true;
    this.errorMessage = '';
    this.loadedImages = {};
    this.closeImageModal();

    try {
      const { data: galleryRecord, error: galleryError } = await this.supabase.getClient()
        .from('portfolio_galleries')
        .select(`
          gallery_id,
          slug,
          couple_names,
          venue,
          cover_image_url,
          hero_image_url,
          description
        `)
        .eq('slug', slug)
        .single();

      if (galleryError || !galleryRecord) {
        console.error('Error fetching gallery:', galleryError);
        this.router.navigate(['/portfolio']);
        return;
      }

      const { data: images, error: imagesError } = await this.supabase.getClient()
        .from('portfolio_images')
        .select(`
          image_id,
          gallery_id,
          image_url,
          alt_text,
          view_order,
          is_visible,
          thumb_url,
          full_url,
          created_at
        `)
        .eq('gallery_id', galleryRecord.gallery_id)
        .eq('is_visible', true)
        .order('view_order', { ascending: true });

      if (imagesError) {
        console.error('Error fetching gallery images:', imagesError);
        this.errorMessage = 'Failed to load gallery images.';
        return;
      }

      this.gallery = this.mapGalleryToViewModel(
        galleryRecord as PortfolioGalleryRecord,
        (images ?? []) as PortfolioImage[]
      );
    } catch (error) {
      console.error('Unexpected gallery load error:', error);
      this.errorMessage = 'Failed to load gallery.';
    }
  }

  private mapGalleryToViewModel(
    gallery: PortfolioGalleryRecord,
    images: PortfolioImage[]
  ): PortfolioGalleryViewModel {
    return {
      slug: gallery.slug,
      coupleNames: gallery.couple_names,
      venue: gallery.venue,
      coverImage: gallery.cover_image_url,
      heroImage: gallery.hero_image_url || gallery.cover_image_url,
      description: gallery.description || '',
      images: images.map(img => ({
        imageId: img.image_id,
        imageUrl: img.image_url,
        thumbUrl: img.thumb_url,
        fullUrl: img.full_url,
        altText: img.alt_text || gallery.couple_names,
        viewOrder: img.view_order
      }))
    };
  }
}