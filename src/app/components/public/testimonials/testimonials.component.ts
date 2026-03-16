import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

interface Testimonial {
  title: string;
  reviewer: string;
  role?: string;
  event?: string;
  quote: string;
  image: string;
}

interface CtaBlock {
  eyebrow: string;
  heading: string;
  text: string;
  buttonText: string;
  buttonLink: string;
  image?: string;
}

@Component({
  selector: 'app-testimonials',
  imports: [CommonModule, RouterLink],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss'
})
export class TestimonialsComponent {
  testimonials: Testimonial[] = [
    {
      title: 'Exceeded every expectation',
      reviewer: 'Matt & Kimberly',
      role: 'Wedding Clients',
      event: 'Newport, Rhode Island',
      quote:
        `Working with Black Begonia was one of the best decisions we made for our wedding. Every arrangement felt deeply intentional, romantic, and completely tailored to us. The floral designs elevated the entire atmosphere and made our day feel even more magical than we imagined.`,
      image: 'assets/images/weddings/Matt-Kimberly/473441856_1147604270271762_4736518673784938733_n.jpg'
    },
    {
      title: 'Elegant, thoughtful, unforgettable',
      reviewer: 'Nathan & Kirsten',
      role: 'Wedding Clients',
      event: 'Coastal Celebration',
      quote:
        `Dear Becca, There are not enough words to express how perfect our flowers were on our wedding day. You were the only vender that came through for us. You were flawless. Thank you so much for everything. Your talent, attention to detail, knowledge, personality, just everything. We never had to worry about a thing. We appreciate you and everything you are accomplishing. Cheers to 2023 and your store!! You will do beautiful things.`,
      image: 'assets/images/weddings/Kirsten-Nate/0513-OLAS-_Y8A4519.jpg'
    },
    {
      title: 'A designer with incredible vision',
      reviewer: 'Emily R.',
      role: 'Bride',
      event: 'Garden Wedding',
      quote:
        `The florals were breathtaking and felt like they belonged in a magazine. Every bouquet, centerpiece, and detail reflected so much care and creativity. I felt completely confident throughout the process, and the final result was more beautiful than I could have dreamed.`,
      image: 'assets/images/1000005214.jpg'
    },
    {
      title: 'So personal and beautifully curated',
      reviewer: 'Sophia & Daniel',
      role: 'Wedding Clients',
      event: 'Estate Wedding',
      quote:
        `Black Begonia made us feel heard, inspired, and taken care of from start to finish. The florals tied the whole day together and made every space feel warm, romantic, and elevated. We are still looking back at photos completely in awe.`,
      image: 'assets/images/1000005237.jpg'
    },
    {
      title: 'The details were beyond beautiful',
      reviewer: 'Olivia M.',
      role: 'Bride',
      event: 'Classic Wedding',
      quote:
        `Every single floral element felt refined, intentional, and stunning. Rebecca has such a gift for pairing color, texture, and movement in a way that feels both luxurious and natural. I could not have asked for a more beautiful floral experience.`,
      image: 'assets/images/472755947_1141939314171591_5484417455789170093_n.jpg'
    },
    {
      title: 'Professional, calm, and artistic',
      reviewer: 'Grace & Tyler',
      role: 'Wedding Clients',
      event: 'Private Venue Celebration',
      quote:
        `Not only was the work beautiful, but the experience of working together was so smooth and reassuring. We felt supported throughout the planning process, and the final floral styling brought such a romantic and elevated feeling to the day.`,
      image: 'assets/images/weddings/Eric-Madison/1000005207.jpg'
    }
  ];

  ctaBlocks: CtaBlock[] = [
    {
      eyebrow: 'READY TO BEGIN?',
      heading: 'Let’s design florals that feel unforgettable.',
      text:
        `From intimate celebrations to full wedding floral styling, we create romantic, artful designs tailored to your story, palette, and setting.`,
      buttonText: 'Inquire Now',
      buttonLink: '/contact',
      image: 'assets/images/Screen Shot 2022-12-13 at 1.39.45 PM.png'
    },
    {
      eyebrow: 'VIEW MORE OF OUR WORK',
      heading: 'See how each celebration comes to life.',
      text:
        `Explore curated floral galleries, installation details, and design moments from past weddings and events throughout Rhode Island and beyond.`,
      buttonText: 'View Portfolio',
      buttonLink: '/portfolio',
      image: 'assets/images/Screen Shot 2022-12-13 at 1.39.45 PM.png'
    }
  ];

  getCtaForGroup(groupIndex: number): CtaBlock {
    return this.ctaBlocks[groupIndex % this.ctaBlocks.length];
  }

  getStarArray(count: number): number[] {
    return Array(count).fill(0);
  }
}
