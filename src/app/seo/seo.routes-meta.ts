// Example route meta config. Import this in your route listener to auto-apply.
export type RouteMeta = {
  path: string; // app route path as navigated (no leading slash)
  title: string;
  description: string;
  keywords?: string[];
  image?: string;
};

export const ROUTE_META: RouteMeta[] = [
  {
    path: '',
    title: 'Black Begonia Florals | Connecticut Wedding Florist',
    description:
      'New England wedding florist led by Rebecca Barna. Specializing in bridal bouquets, ceremony flowers, reception florals & event design across RI, CT & MA.',
    keywords: [
      'Rebecca Barna',
      'Black Begonia Florals',
      'New England Wedding Florist',
      'Rhode Island Wedding Florist',
      'Connecticut Wedding Florist',
      'Massachusetts Wedding Florist',
      'Providence Wedding Flowers',
      'Newport Wedding Florist',
      'Luxury Wedding Florist New England',
      'Wedding Bouquets RI CT MA',
      'Bridal Party Flowers',
      'Wedding Ceremony Flowers',
      'Wedding Reception Flowers',
      'Event Florist Rhode Island',
      'Event Flowers Connecticut',
      'Event Flowers Massachusetts',
      'Custom Wedding Florist',
      'Wedding Arch Flowers',
      'Floral Installations',
      'Centerpiece Designs',
      'Seasonal Wedding Flowers',
      'Romantic Wedding Flowers',
      'Garden-Style Bouquets',
      'Whimsical Wedding Flowers',
      'Modern Wedding Florist',
      'Classic Wedding Florals',
      'Rustic Wedding Flowers',
      'New England Event Design',
      'Bouquet Inspiration RI',
      'Best Wedding Florist New England'
    ]
  },
  {
    path: 'portfolio',
    title: 'Wedding Flower Portfolio | Bouquets, Ceremonies & Receptions',
    description:
      'Explore Black Begonia Florals portfolio of custom wedding flowers: bridal bouquets, ceremony arches, reception centerpieces & event florals throughout New England.',
    keywords: [
      'Wedding Flower Portfolio',
      'Wedding Bouquets Gallery',
      'Ceremony Flower Designs',
      'Reception Flower Ideas',
      'Event Floral Portfolio',
      'Bridal Bouquet Inspiration',
      'New England Weddings',
      'Luxury Wedding Florals',
      'Custom Floral Arrangements',
      'Rustic Wedding Bouquets',
      'Romantic Wedding Flowers',
      'Boho Wedding Flowers',
      'Classic Wedding Bouquets',
      'Seasonal Flower Arrangements',
      'Fall Wedding Flowers',
      'Spring Wedding Bouquets',
      'Summer Wedding Flowers',
      'Winter Wedding Florals',
      'Providence Wedding Florist',
      'Newport Wedding Flowers',
      'Connecticut Event Florist',
      'Massachusetts Wedding Flowers',
      'Ceremony Arch Florals',
      'Reception Centerpieces',
      'Floral Installations Portfolio',
      'Outdoor Wedding Flowers',
      'Indoor Wedding Floral Designs',
      'Bridal Party Flower Gallery',
      'Boutonnieres & Corsages',
      'Luxury Bouquet Portfolio'
    ]
  },
  {
    path: 'services',
    title: 'Wedding Florist Services | Floral Design & Event Styling',
    description:
      'Full-service wedding florist offering consultations, design boards, custom bouquets, ceremony florals, centerpieces & luxury event styling in New England.',
    keywords: [
      'Wedding Florist Services',
      'Wedding Floral Design',
      'Bridal Party Bouquets',
      'Ceremony Flower Installations',
      'Reception Centerpieces',
      'Luxury Wedding Flowers',
      'Event Design New England',
      'Floral Consultation',
      'Custom Wedding Florist',
      'Wedding Flower Packages',
      'Day-of Wedding Florist',
      'Full-Service Wedding Florist',
      'Wedding Design Boards',
      'Floral Event Styling',
      'Boutonnieres & Corsages',
      'Flower Crown Designs',
      'Ceremony Arch Flowers',
      'Reception Floral Styling',
      'Luxury Centerpiece Florist',
      'Seasonal Floral Design',
      'Eco-Friendly Wedding Florist',
      'Rustic Wedding Floral Services',
      'Modern Wedding Florist',
      'Boho Wedding Flower Packages',
      'Classic Floral Services',
      'Luxury Event Florist RI',
      'Connecticut Wedding Design',
      'Massachusetts Event Styling',
      'Newport Wedding Floral Services',
      'Providence Floral Services'
    ]
  },
  {
    path: 'inquiries',
    title: 'Contact Black Begonia Florals | Book Your Wedding Consultation',
    description:
      'Get in touch with Black Begonia Florals to plan your dream wedding flowers in Rhode Island, Connecticut, Massachusetts & New England. Book your consultation today.',
    keywords: [
      'Contact Wedding Florist',
      'Book Wedding Consultation',
      'Rhode Island Wedding Flowers',
      'Connecticut Wedding Florist',
      'Massachusetts Wedding Florist',
      'New England Wedding Flowers',
      'Luxury Florist Booking',
      'Wedding Floral Consultation',
      'Event Consultation New England',
      'Schedule Florist Appointment',
      'Wedding Inquiry Form',
      'Wedding Flower Booking RI',
      'Newport Wedding Consultation',
      'Providence Wedding Florist Contact',
      'Contact Rebecca Barna Florist',
      'Bridal Flower Consultation',
      'Reception Flower Planning',
      'Ceremony Flower Planning',
      'Destination Wedding Flowers New England',
      'Luxury Event Consultation',
      'Wedding Flower Packages RI',
      'Wedding Florist Near Me',
      'Bridal Party Flower Booking',
      'Book Ceremony Florist',
      'Book Reception Florals',
      'Wedding Vendor Contact RI',
      'Wedding Vendor Contact CT',
      'Wedding Vendor Contact MA',
      'Inquire About Wedding Flowers',
      'Plan Wedding Flowers Rhode Island'
    ]
  }
];

