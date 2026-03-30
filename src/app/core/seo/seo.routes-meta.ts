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
    title: 'Black Begonia Florals | Rhode Island Wedding Florist',
    description:
      'New England wedding florist led by Becca Shappy. Specializing in bridal bouquets, ceremony flowers, reception florals & event design across RI, CT & MA.',
    keywords: [
      'Becca Shappy',
      'Shecca Bappy',
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
      'Contact Becca Shappy Florist',
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
  },
  {
    path: 'locations/newport-ri-wedding-florist',
    title: 'Newport RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Newport RI wedding florist creating romantic bouquets, ceremony flowers, and refined reception florals for coastal Rhode Island weddings.',
    keywords: [
      'Newport RI Wedding Florist',
      'Newport Wedding Florist',
      'Newport Wedding Flowers',
      'Coastal Wedding Florist Rhode Island',
      'Luxury Wedding Florist Newport RI',
      'Rhode Island Wedding Florist',
      'New England Wedding Florist',
      'Bridal Bouquets Newport RI',
      'Ceremony Flowers Newport RI',
      'Reception Flowers Newport RI'
    ]
  },
  {
    path: 'locations/watch-hill-ri-wedding-florist',
    title: 'Watch Hill RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals creates elegant wedding flowers for Watch Hill RI celebrations, including bouquets, ceremony florals, and reception floral design for coastal weddings.',
    keywords: [
      'Watch Hill RI Wedding Florist',
      'Watch Hill Wedding Florist',
      'Watch Hill Wedding Flowers',
      'Coastal Wedding Florist RI',
      'Luxury Wedding Florist Watch Hill',
      'Westerly Wedding Florist',
      'Rhode Island Wedding Florist',
      'New England Wedding Florist',
      'Bridal Bouquets Watch Hill',
      'Ceremony Flowers Watch Hill'
    ]
  },
  {
    path: 'locations/providence-ri-wedding-florist',
    title: 'Providence RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Providence RI wedding florist creating refined bouquets, ceremony flowers, and reception florals for city weddings and elegant events.',
    keywords: [
      'Providence RI Wedding Florist',
      'Providence Wedding Florist',
      'Providence Wedding Flowers',
      'Rhode Island Wedding Florist',
      'Luxury Wedding Florist Providence',
      'City Wedding Florist Rhode Island',
      'Bridal Bouquets Providence RI',
      'Ceremony Flowers Providence RI',
      'Reception Flowers Providence RI',
      'New England Wedding Florist'
    ]
  },
  {
    path: 'locations/bristol-ri-wedding-florist',
    title: 'Bristol RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals designs elegant wedding flowers for Bristol RI weddings, including bouquets, ceremony florals, centerpieces, and full floral styling.',
    keywords: [
      'Bristol RI Wedding Florist',
      'Bristol Wedding Florist',
      'Bristol Wedding Flowers',
      'Rhode Island Wedding Florist',
      'Luxury Wedding Florist Bristol RI',
      'Coastal Wedding Florist Rhode Island',
      'Bridal Bouquets Bristol RI',
      'Ceremony Flowers Bristol RI',
      'Reception Flowers Bristol RI',
      'New England Wedding Florist'
    ]
  },
  {
    path: 'locations/south-kingstown-ri-wedding-florist',
    title: 'South Kingstown RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a South Kingstown RI wedding florist designing bouquets, ceremony flowers, and elegant reception florals for Rhode Island weddings.',
    keywords: [
      'South Kingstown RI Wedding Florist',
      'South Kingstown Florist',
      'South Kingstown Wedding Flowers',
      'South County Wedding Florist',
      'Rhode Island Wedding Florist',
      'Luxury Wedding Florist South Kingstown',
      'Bridal Bouquets South Kingstown RI',
      'Ceremony Flowers South Kingstown RI',
      'Reception Flowers South Kingstown RI',
      'New England Wedding Florist'
    ]
  },
  {
    path: 'locations/narragansett-ri-wedding-florist',
    title: 'Narragansett RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Narragansett RI wedding florist creating coastal bouquets, ceremony flowers, and elegant reception florals for Rhode Island weddings.',
    keywords: [
      'Narragansett RI Wedding Florist',
      'Narragansett Wedding Florist',
      'Narragansett Wedding Flowers',
      'Coastal Wedding Florist Rhode Island',
      'Rhode Island Wedding Florist',
      'Luxury Wedding Florist Narragansett',
      'Beach Wedding Flowers Rhode Island',
      'Bridal Bouquets Narragansett RI',
      'Ceremony Flowers Narragansett RI',
      'Reception Flowers Narragansett RI'
    ]
  },
  {
    path: 'locations/westerly-ri-wedding-florist',
    title: 'Westerly RI Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Westerly RI wedding florist creating refined bouquets, ceremony flowers, and elegant reception florals for coastal Rhode Island weddings.',
    keywords: [
      'Westerly RI Wedding Florist',
      'Westerly Wedding Florist',
      'Westerly Wedding Flowers',
      'Rhode Island Wedding Florist',
      'Luxury Wedding Florist Westerly',
      'Watch Hill Wedding Florist',
      'Coastal Wedding Florist RI',
      'Bridal Bouquets Westerly RI',
      'Ceremony Flowers Westerly RI',
      'Reception Flowers Westerly RI'
    ]
  },
  {
    path: 'locations/north-kingstown-ri-florist',
    title: 'North Kingstown RI Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a North Kingstown RI florist creating wedding flowers, event florals, bouquets, and custom floral design for Rhode Island celebrations.',
    keywords: [
      'North Kingstown RI Florist',
      'North Kingstown Florist',
      'North Kingstown Wedding Florist',
      'North Kingstown Wedding Flowers',
      'Rhode Island Florist',
      'Rhode Island Wedding Florist',
      'Custom Floral Design North Kingstown',
      'Event Florist North Kingstown RI',
      'Bouquets North Kingstown RI',
      'Wedding Flowers North Kingstown RI'
    ]
  },
  {
    path: 'locations/mystic-ct-wedding-florist',
    title: 'Mystic CT Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Mystic CT wedding florist creating romantic bouquets, ceremony flowers, and coastal reception florals for Connecticut weddings.',
    keywords: [
      'Mystic CT Wedding Florist',
      'Mystic Wedding Florist',
      'Mystic Wedding Flowers',
      'Connecticut Wedding Florist',
      'Coastal Wedding Florist Connecticut',
      'Luxury Wedding Florist Mystic CT',
      'Bridal Bouquets Mystic CT',
      'Ceremony Flowers Mystic CT',
      'Reception Flowers Mystic CT',
      'New England Wedding Florist'
    ]
  },
  {
    path: 'locations/stonington-ct-wedding-florist',
    title: 'Stonington CT Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Stonington CT wedding florist creating elegant bouquets, ceremony flowers, and refined reception florals for Connecticut weddings.',
    keywords: [
      'Stonington CT Wedding Florist',
      'Stonington Wedding Florist',
      'Stonington Wedding Flowers',
      'Connecticut Wedding Florist',
      'Luxury Wedding Florist Stonington CT',
      'Coastal Wedding Florist Connecticut',
      'Bridal Bouquets Stonington CT',
      'Ceremony Flowers Stonington CT',
      'Reception Flowers Stonington CT',
      'New England Wedding Florist'
    ]
  },
  {
    path: 'locations/boston-ma-wedding-florist',
    title: 'Boston MA Wedding Florist | Black Begonia Florals',
    description:
      'Black Begonia Florals is a Boston MA wedding florist creating elegant bouquets, ceremony flowers, and refined reception florals for Massachusetts and New England weddings.',
    keywords: [
      'Boston MA Wedding Florist',
      'Boston Wedding Florist',
      'Boston Wedding Flowers',
      'Massachusetts Wedding Florist',
      'Luxury Wedding Florist Boston MA',
      'New England Wedding Florist',
      'Bridal Bouquets Boston MA',
      'Ceremony Flowers Boston MA',
      'Reception Flowers Boston MA',
      'Editorial Wedding Florist Boston'
    ]
  },
  {
    path: 'locations',
    title: 'Locations We Serve | Rhode Island & New England Wedding Florist',
    description:
      'Explore the locations Black Begonia Florals serves across Rhode Island, Connecticut, Massachusetts, and New England for wedding flowers and floral design.',
    keywords: [
      'Rhode Island Wedding Florist',
      'New England Wedding Florist',
      'Locations Wedding Florist',
      'Newport Wedding Florist',
      'Watch Hill Wedding Florist',
      'Providence Wedding Florist',
      'Narragansett Wedding Florist',
      'Westerly Wedding Florist',
      'Mystic CT Wedding Florist',
      'Boston MA Wedding Florist'
    ]
  }
];

