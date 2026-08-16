import { ComponentFixture, TestBed } from '@angular/core/testing';

import { WorkshopMedia } from '../../../../core/models/workshop';
import { WorkshopCustomerPreviewComponent } from './workshop-customer-preview.component';

describe('WorkshopCustomerPreviewComponent', () => {
  let fixture: ComponentFixture<WorkshopCustomerPreviewComponent>;
  let component: WorkshopCustomerPreviewComponent;

  const media = (role: 'hero' | 'gallery', id: string): WorkshopMedia => ({
    workshop_media_id: id,
    workshop_definition_id: 'definition-1',
    workshop_occurrence_id: null,
    media_role: role,
    storage_path: `${id}.jpg`,
    public_url: `https://example.com/${id}.jpg`,
    alt_text: `${id} alternative text`,
    display_order: role === 'hero' ? 0 : 1,
    is_public: true,
    width: 1200,
    height: 800,
    byte_size: 1000,
    mime_type: 'image/jpeg',
    created_by: null,
    created_at: '2027-01-01T00:00:00Z',
    updated_at: '2027-01-01T00:00:00Z',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [WorkshopCustomerPreviewComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(WorkshopCustomerPreviewComponent);
    component = fixture.componentInstance;
  });

  it('shows the date and annotated time on separate lines', () => {
    component.dateLabel = '27 March 2027';
    component.timeLabel = '@ 10:30 AM - 11:30 AM';
    fixture.detectChanges();

    const lines = fixture.nativeElement.querySelectorAll('.when span');
    expect(lines.length).toBe(2);
    expect(lines[0].textContent.trim()).toBe('27 March 2027');
    expect(lines[1].textContent.trim()).toBe('@ 10:30 AM - 11:30 AM');
  });

  it('renders the selected hero and the customer gallery', () => {
    const hero = media('hero', 'hero');
    const gallery = media('gallery', 'gallery');
    component.hero = hero;
    component.gallery = [gallery];
    fixture.detectChanges();

    const heroImage = fixture.nativeElement.querySelector('.hero-background');
    const galleryImages = fixture.nativeElement.querySelectorAll('.gallery img');
    expect(heroImage.src).toBe(hero.public_url);
    expect(heroImage.alt).toBe(hero.alt_text);
    expect(galleryImages.length).toBe(1);
    expect(galleryImages[0].src).toBe(gallery.public_url);
  });

  it('omits the arrangement gallery when no gallery images were uploaded', () => {
    component.hero = media('hero', 'hero');
    component.gallery = [];
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.gallery')).toBeNull();
  });

  it('emits when the preview is closed', () => {
    spyOn(component.closed, 'emit');
    fixture.detectChanges();

    fixture.nativeElement.querySelector('.preview-close').click();

    expect(component.closed.emit).toHaveBeenCalled();
  });

  it('uses a centered vector icon for the circular close control', () => {
    fixture.detectChanges();

    const closeButton = fixture.nativeElement.querySelector('.preview-close');
    expect(closeButton.querySelector('svg')).not.toBeNull();
    expect(closeButton.textContent.trim()).toBe('');
  });
});
