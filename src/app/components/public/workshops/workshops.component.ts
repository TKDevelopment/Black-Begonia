import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

interface WorkshopSection {
  key: string;
  title: string;
  subtitle: string;
  description: string;
  inquiryLink: string;
  images: string[];
  currentIndex: number;
  nextIndex: number | null;
  displayRight: boolean;
  isTransitioning: boolean;
}

@Component({
  selector: 'app-workshops',
  standalone: true,
  imports: [CommonModule, RouterModule, NgOptimizedImage],
  templateUrl: './workshops.component.html',
  styleUrl: './workshops.component.scss'
})
export class WorkshopsComponent {
  workshopSections: WorkshopSection[] = [
    {
      key: 'christmas',
      title: 'Christmas Wreaths & Florals',
      subtitle: 'Festive designs for holiday gatherings and seasonal celebrations',
      description:
        'Celebrate the season with floral workshops inspired by winter gatherings, holiday tables, and festive décor. These workshops are perfect for private parties, client appreciation events, team gatherings, and seasonal celebrations, with designs that feel elegant, cozy, and beautifully handcrafted.',
      inquiryLink: '/inquiries/general',
      images: [
        'assets/images/website/472561162_1142987654066757_7627198848626149535_n.jpg',
        'assets/images/website/472845039_1144761933889329_2522081227920482125_n.jpg',
        'assets/images/website/472426717_1142453157453540_1972288464951160397_n.jpg',
        'assets/images/website/472388906_1142987780733411_4142060325698127741_n.jpg',
        'assets/images/website/472912747_1144761880556001_5623808859771936946_n.jpg',
        'assets/images/website/472918267_1144766090555580_3237870024136338012_n.jpg',
        'assets/images/website/472376511_1142997157399140_7005199389945608402_n.jpg',
        'assets/images/website/472375722_1142996900732499_3316445833226880373_n.jpg',
        'assets/images/website/472792658_1144766487222207_1278343022464181299_n.jpg',
        'assets/images/website/472794767_1144761897222666_8107363045177721527_n.jpg',
        'assets/images/website/472526294_1142465980785591_5885163980596476781_n.jpg',
        'assets/images/website/472808145_1144766430555546_3710592167298526049_n.jpg',
        'assets/images/website/472830046_1144765013889021_4038425973794968380_n.jpg',
        'assets/images/website/472834995_1144761887222667_8067126573689715148_n.jpg',
        'assets/images/website/472841015_1144765030555686_8446851363371805571_n.jpg',
        'assets/images/website/473082073_1144761890556000_4184374810562527796_n.jpg',
        'assets/images/website/473083099_1144765450555644_8856898632803313588_n.jpg',
        'assets/images/website/473099335_1144766497222206_6882786993740356165_n.jpg',
        'assets/images/website/473121297_1144761923889330_718776906977631795_n.jpg',
        'assets/images/website/473141024_1144766073888915_7036648267672602053_n.jpg',
        'assets/images/website/472969532_1144765037222352_1417484722264208418_n.jpg'
      ],
      currentIndex: 0,
      nextIndex: null,
      displayRight: false,
      isTransitioning: false
      
    },
    {
      key: 'fall',
      title: 'Fall & Thanksgiving Decor',
      subtitle: 'Warm, textural floral experiences inspired by the autumn season',
      description:
        'Gather around the richness of the season with floral workshops featuring warm tones, textural elements, and arrangements inspired by autumn entertaining. These experiences are ideal for Thanksgiving hosts, community events, and groups looking for a creative, seasonal activity.',
      inquiryLink: '/inquiries/general',
      images: [
        'assets/images/website/489444803_1201376215325113_3157936810932011361_n.jpg',
        'assets/images/website/472337699_1142444514121071_8713096277024086034_n.jpg',
        'assets/images/website/122977927_184819483216917_3621365564105853676_n.jpg',
        'assets/images/472999197_1147600846938771_9130901346915404353_n.jpg'
      ],
      currentIndex: 0,
      nextIndex: null,
      displayRight: true,
      isTransitioning: false
    },
    {
      key: 'social',
      title: 'General Social Events',
      subtitle: 'Custom floral experiences for private events and special occasions',
      description:
        'Create a memorable hands-on experience for your next gathering with custom floral workshops tailored to birthdays, showers, private parties, brand events, and other social occasions. Each workshop can be designed around your event style, guest count, and overall vision.',
      inquiryLink: '/inquiries/general',
      images: [
        'assets/images/website/fizzandfrites-152.jpg',
        'assets/images/website/487367734_1194785119317556_2221152768559106190_n.jpg',
        'assets/images/website/486955655_1194784742650927_963388610016831666_n.jpg',
        'assets/images/website/157266871_264350035263861_7456896409632197832_n.jpg'
      ],
      currentIndex: 0,
      nextIndex: null,
      displayRight: false,
      isTransitioning: false
    }
  ];

  nextSlide(section: WorkshopSection): void {
    const newIndex = (section.currentIndex + 1) % section.images.length;
    this.crossfadeToImage(section, newIndex);
  }

  prevSlide(section: WorkshopSection): void {
    const newIndex =
      (section.currentIndex - 1 + section.images.length) % section.images.length;
    this.crossfadeToImage(section, newIndex);
  }

  goToSlide(section: WorkshopSection, index: number): void {
    if (index === section.currentIndex) return;
    this.crossfadeToImage(section, index);
  }

  private crossfadeToImage(section: WorkshopSection, newIndex: number): void {
    if (section.isTransitioning || newIndex === section.currentIndex) return;

    section.nextIndex = newIndex;
    section.isTransitioning = true;

    setTimeout(() => {
      section.currentIndex = newIndex;
      section.nextIndex = null;
      section.isTransitioning = false;
    }, 300);
  }
}