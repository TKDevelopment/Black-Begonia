import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from "@angular/router";
import { SeoService } from '../../../core/seo/seo.service';
import { JsonLdService } from '../../../core/seo/jsonld.service';

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent implements OnInit {
  images: string[] = [
    'assets/images/1000005141.jpg',
    'assets/images/1000005142.jpg',
    'assets/images/1000005143.jpg',
    'assets/images/1000005144.jpg',
    'assets/images/1000005145.jpg',
  ];

  currentIndex = 0;

  constructor(
    private seo: SeoService,
    private jsonLd: JsonLdService
  ) {}

  ngOnInit(): void {
    this.seo.setPageMeta({
      title: 'Black Begonia Florals | Rhode Island Wedding Florist',
      description:
        'Black Begonia Florals creates luxury wedding flowers and fine art floral design across Rhode Island, Newport, Watch Hill, and New England.',
      url: 'https://blackbegoniaflorals.com/',
      image: 'https://blackbegoniaflorals.com/assets/images/og-default.png',
      keywords: [
        'Black Begonia Florals',
        'Rhode Island Wedding Florist',
        'Newport Wedding Florist',
        'Watch Hill Wedding Florist',
        'New England Wedding Florist'
      ]
    });

    this.jsonLd.clearPageSchemas();
    this.jsonLd.setLocalBusiness();
    this.jsonLd.setWebsite();
  }

  get leftIndex() {
    return (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  get rightIndex() {
    return (this.currentIndex + 1) % this.images.length;
  }

  prev() {
    this.currentIndex = (this.currentIndex - 1 + this.images.length) % this.images.length;
  }

  next() {
    this.currentIndex = (this.currentIndex + 1) % this.images.length;
  }
}
