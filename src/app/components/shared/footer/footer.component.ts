import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  imports: [CommonModule, RouterLink],
  templateUrl: './footer.component.html',
  styleUrl: './footer.component.scss'
})
export class FooterComponent {
  @ViewChild('gallery', { static: true }) gallery!: ElementRef<HTMLDivElement>;

  // Placeholder list (you can swap this with real image objects later)
  galleryItems = [
    { url: 'assets/images/1000005130.jpg' },
    { url: 'assets/images/1000005131.jpg' },
    { url: 'assets/images/1000005132.jpg' },
    { url: 'assets/images/1000005133.jpg' },
    { url: 'assets/images/1000005134.jpg' },
    { url: 'assets/images/1000005135.jpg' },
    { url: 'assets/images/1000005136.jpg' },
    { url: 'assets/images/1000005137.jpg' },
    { url: 'assets/images/1000005138.jpg' },
    { url: 'assets/images/1000005139.jpg' },
    { url: 'assets/images/1000005140.jpg' },
    { url: 'assets/images/1000005141.jpg' },
    { url: 'assets/images/1000005142.jpg' },
    { url: 'assets/images/weddings/Matt-Kimberly/1000005143.jpg' },
    { url: 'assets/images/weddings/Eric-Madison/1000005144.jpg' },
    { url: 'assets/images/weddings/Matt-Kimberly/1000005145.jpg' },
    { url: 'assets/images/weddings/Matt-Kimberly/1000005146.jpg' },
    { url: 'assets/images/1000005147.jpg' },
    { url: 'assets/images/weddings/Matt-Kimberly/1000005148.jpg' },
    { url: 'assets/images/weddings/Siwei+Simon/1000005149.jpg' },
  ];

  scrollGallery(direction: 1 | -1) {
    const el = this.gallery.nativeElement;

    // Scroll by ~2 tiles per click (adjust if you want)
    const scrollAmount = 250 * 2 + 16 * 2; // tile size + gaps
    el.scrollBy({ left: direction * scrollAmount, behavior: 'smooth' });
  }
}
