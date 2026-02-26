import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from "@angular/router";

@Component({
  selector: 'app-landing',
  imports: [CommonModule, RouterLink],
  templateUrl: './landing.component.html',
  styleUrl: './landing.component.scss'
})
export class LandingComponent {
  images: string[] = [
    'assets/images/1000005141.jpg',
    'assets/images/1000005142.jpg',
    'assets/images/1000005143.jpg',
    'assets/images/1000005144.jpg',
    'assets/images/1000005145.jpg',
  ];

  currentIndex = 0;

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
