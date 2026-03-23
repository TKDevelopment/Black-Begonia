import { CommonModule, NgOptimizedImage } from '@angular/common';
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
  imports: [CommonModule, RouterLink, NgOptimizedImage],
  templateUrl: './testimonials.component.html',
  styleUrl: './testimonials.component.scss'
})
export class TestimonialsComponent {
  testimonials: Testimonial[] = [
    {
      title: 'The details were beyond beautiful',
      reviewer: 'Lindsay & Matt',
      role: 'Bride',
      event: 'Classic Wedding',
      quote:
        `I cannot say enough wonderful things about Becca and Black Begonia! Becca's attention to detail and willingness to hear out and execute my wedding day vision was beyond anything I could have imagined. She is sweet as can be and really went the extra mile. I cannot recommend her enough.`,
      image: 'assets/images/website/472755947_1141939314171591_5484417455789170093_n.jpg'
    },
    {
      title: 'So personal and beautifully curated',
      reviewer: 'Morgan & Nick',
      role: 'Wedding Clients',
      event: 'Estate Wedding',
      quote:
        `Becca was extremely attentive and flexible with our wedding florals! She sent photos of every flower and greenery when we first discussed her doing our wedding. I changed my mind multiple times and she was so flexible and willing to do anything. Our centerpieces were amazing, as were the bouquets!!!`,
      image: 'assets/images/473032518_1147611050271084_8704592988378089709_n (2).jpg'
    },
    {
      title: 'Elegant, thoughtful, unforgettable',
      reviewer: 'Meg Rosenberg',
      role: 'Wedding Clients',
      event: 'Coastal Celebration',
      quote:
        `Becca did such a phenomenal job with the flowers and floral arrangements. I didn’t really have a specific vision in mind, I just knew that I wanted something more unique rather than “classic bridal” and everything came out stunning! She also checked in the morning of to make sure that I liked everything. She also did the arrangements for my rehearsal dinner the day before, which were more “classic bridal” and were also so stunning! She has an incredible scope of design and I couldn’t be happier with how the flowers turned out.`,
      image: 'assets/images/website/1000005268.jpg'
    },
    {
      title: 'A designer with incredible vision',
      reviewer: 'Kayla & Samuel',
      role: 'Wedding Clients',
      event: 'Classic Wedding',
      quote:
        `From the first time I chatted with Becca about our wedding, I knew she understood our vision with the florals and that she was a florist I could trust with bringing this vision to life. Becca was extremely attentive and reliable – whenever I had a random, one-off question, she was there to chat. On the wedding day, Becca went above and beyond. The florals were absolutely beautiful, and my bridal bouquet was everything I wanted and more. She even popped upstairs to the bridal suite to say hello before heading out – which was so nice to finally meet the famous “Becca” in person. If you’re getting married and in need of a florist, don’t hesitate on reaching out to Becca. When you hire vendors for a wedding, you want people you can trust – and Becca is that and so much more.`,
      image: 'assets/images/website/Screenshot 2026-03-22 214221.png'
    },
    {
      title: '',
      reviewer: 'Nathan & Kirsten',
      role: 'Wedding Clients',
      event: 'Coastal Celebration',
      quote:
        `Dear Becca, There are not enough words to express how perfect our flowers were on our wedding day. You were the only vender that came through for us. You were flawless. Thank you so much for everything. Your talent, attention to detail, knowledge, personality, just everything. We never had to worry about a thing. We appreciate you and everything you are accomplishing. Cheers to 2023 and your store!! You will do beautiful things.`,
      image: 'assets/images/website/0513-OLAS-_Y8A4519.jpg'
    },
    {
      title: '',
      reviewer: 'Rayanne & Kevin',
      role: 'Bride',
      event: 'Garden Wedding',
      quote:
        `Becca did the florals for my wedding and they were so beautiful. Everyone commented on how amazing everything turned out. She paid so much attention to detail and made all of my visions come to life. She was super accommodating with everything. 15/10 recommend for your wedding.`,
      image: 'assets/images/website/1000005214.jpg'
    },
    {
      title: '',
      reviewer: 'Alexandra & Joshua',
      role: 'Wedding Clients',
      event: 'Private Venue Celebration',
      quote:
        `Black Begonia Floral Design provided my wedding with the most STUNNING floral arrangements!! Breath taking. The owner is a true artist with her work! Made for the most stunning details for our big day!! Brides, Becca will work with you to get you your dream bouquet! I speak from experience! My bouquet had texture and when I asked her for a wild flower (but fall) vibe, she did JUST THAT. I can't speak highly enough of her work!! Pictures don't do it justice for the beauty of her work in person!!`,
      image: 'assets/images/website/1000005267.jpg'
    },
    
  ];

  ctaBlocks: CtaBlock[] = [
    {
      eyebrow: 'READY TO BEGIN?',
      heading: 'Let’s design florals that feel unforgettable.',
      text:
        `From intimate celebrations to full wedding floral styling, we create romantic, artful designs tailored to your story, palette, and setting.`,
      buttonText: 'Inquire Now',
      buttonLink: '/contact',
      image: 'assets/images/website/Screen Shot 2022-12-13 at 1.39.45 PM.png'
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
