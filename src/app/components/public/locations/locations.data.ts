export type LocationPageData = {
  slug: string;
  city: string;
  region: string;
  state: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  heroImage: string;
  heroAlt: string;
  introHeading: string;
  introText: string;
  whyHeading: string;
  whyParagraphs: string[];
  servicesHeading: string;
  services: string[];
  venuesHeading: string;
  venuesIntro: string;
  venueList: string[];
  faqHeading: string;
  faqs: { question: string; answer: string }[];
  ctaHeading: string;
  ctaText: string;
};

export const LOCATION_PAGES: LocationPageData[] = [
  {
    slug: 'newport-ri-wedding-florist',
    city: 'Newport',
    region: 'Newport County',
    state: 'Rhode Island',
    title: 'Newport RI Wedding Florist',
    metaTitle: 'Newport RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/481512519_1171057651690303_421588473930981669_n.jpg',
    heroAlt: 'Luxury wedding florals for a Newport Rhode Island wedding',
    introHeading: 'Luxury Wedding Florals for Newport Celebrations',
    introText:
      'Black Begonia Florals designs romantic, editorial-inspired wedding flowers for couples getting married in Newport, Rhode Island. From refined bridal bouquets to large-scale ceremony installations and reception centerpieces, every floral design is created to feel intentional, artistic, and deeply personal.',
    whyHeading: 'Why Couples Choose Black Begonia Florals in Newport',
    whyParagraphs: [
      'Newport weddings call for florals that feel elevated, coastal, and timeless. We design with the setting in mind, balancing garden-inspired movement with a polished look that complements waterfront venues, historic mansions, tented receptions, and intimate celebrations alike.',
      'Whether your vision leans soft and romantic, modern and sculptural, or lush and color-forward, we create a floral experience that feels cohesive from the first bouquet to the final reception detail.'
    ],
    servicesHeading: 'Wedding Floral Services in Newport',
    services: [
      'Bridal bouquets and bridesmaid flowers',
      'Boutonnieres and personal flowers',
      'Ceremony arches and altar arrangements',
      'Aisle flowers and statement entry florals',
      'Reception centerpieces and candle styling',
      'Sweetheart table, escort display, and bar florals',
      'Floral installations for tented and waterfront weddings'
    ],
    venuesHeading: 'Perfect for Newport Wedding Venues',
    venuesIntro:
      'Our floral style pairs beautifully with the elegant coastal atmosphere couples love in Newport. We are an ideal fit for celebrations at venues and settings such as:',
    venueList: [
      'Oceanfront wedding venues in Newport',
      'Historic mansion weddings',
      'Tented private estate celebrations',
      'Garden ceremony locations',
      'Downtown Newport receptions'
    ],
    faqHeading: 'Newport Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you design flowers for coastal Newport weddings?',
        answer:
          'Yes. We create floral designs that suit Newport’s coastal setting, whether you want airy, romantic blooms or a more refined luxury floral aesthetic.'
      },
      {
        question: 'Can you provide ceremony and reception flowers?',
        answer:
          'Absolutely. We design full wedding florals including bouquets, ceremony flowers, reception centerpieces, and larger floral installations.'
      },
      {
        question: 'Do you serve destination weddings in Newport?',
        answer:
          'Yes. We work with local and destination couples planning weddings in Newport and throughout Rhode Island.'
      }
    ],
    ctaHeading: 'Planning a Newport Wedding?',
    ctaText:
      'If you are searching for a Newport RI wedding florist who values artistry, detail, and a romantic editorial feel, we would love to hear more about your celebration.'
  },
  {
    slug: 'watch-hill-ri-wedding-florist',
    city: 'Watch Hill',
    region: 'Washington County',
    state: 'Rhode Island',
    title: 'Watch Hill RI Wedding Florist',
    metaTitle: 'Watch Hill RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/480770928_1161714895957912_7806770211832974345_n.jpg',
    heroAlt: 'Wedding floral design for a Watch Hill Rhode Island celebration',
    introHeading: 'Elegant Coastal Wedding Flowers in Watch Hill',
    introText:
      'Black Begonia Florals designs wedding flowers for Watch Hill couples who want their day to feel effortless, refined, and deeply memorable. We create bouquets, ceremony flowers, and reception floral designs that feel elevated without losing softness or movement.',
    whyHeading: 'A Floral Style That Fits Watch Hill',
    whyParagraphs: [
      'Watch Hill weddings often blend coastal beauty with understated luxury. Our floral approach is ideal for that atmosphere, combining texture, movement, and a curated palette that feels natural within seaside spaces.',
      'From intimate celebrations to larger tented weddings, we design florals that enhance the setting and create a visually cohesive guest experience.'
    ],
    servicesHeading: 'Wedding Floral Services in Watch Hill',
    services: [
      'Bridal bouquets and personal flowers',
      'Ceremony ground flowers and altar florals',
      'Reception centerpieces and elevated table styling',
      'Statement floral arrangements for entryways and bars',
      'Romantic bud vase and candle pairings',
      'Floral design for tented and waterfront receptions'
    ],
    venuesHeading: 'Designed for Watch Hill Wedding Settings',
    venuesIntro:
      'Our wedding flowers are especially well suited for the kinds of celebrations couples plan in and around Watch Hill, including:',
    venueList: [
      'Oceanfront wedding venues',
      'Luxury inn and resort weddings',
      'Private estate celebrations',
      'Tented coastal receptions',
      'Intimate garden ceremonies'
    ],
    faqHeading: 'Watch Hill Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you provide flowers for seaside weddings in Watch Hill?',
        answer:
          'Yes. We regularly design florals that complement coastal venues and the softer, elegant atmosphere many Watch Hill couples want.'
      },
      {
        question: 'Can you handle both personal flowers and full reception design?',
        answer:
          'Yes. We can create everything from bouquets and boutonnieres to ceremony florals, centerpieces, and large floral moments.'
      },
      {
        question: 'Do you serve couples coming in from out of town?',
        answer:
          'Yes. We work with destination couples as well as local clients throughout Rhode Island and New England.'
      }
    ],
    ctaHeading: 'Getting Married in Watch Hill?',
    ctaText:
      'We would love to help bring your floral vision to life with wedding flowers that feel romantic, refined, and true to your celebration.'
  },
  {
    slug: 'providence-ri-wedding-florist',
    city: 'Providence',
    region: 'Providence County',
    state: 'Rhode Island',
    title: 'Providence RI Wedding Florist',
    metaTitle: 'Providence RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/1000005138.jpg',
    heroAlt: 'Editorial wedding flower design for a Providence Rhode Island wedding',
    introHeading: 'Wedding Flowers for Providence Celebrations',
    introText:
      'Black Begonia Florals creates wedding flowers for Providence couples looking for a design experience that feels thoughtful, elevated, and artistic. We design florals that work beautifully in city venues, historic settings, and modern reception spaces.',
    whyHeading: 'Floral Design for Elegant City Weddings',
    whyParagraphs: [
      'Providence weddings often blend architecture, personality, and style. Our floral work is designed to complement that kind of celebration, whether your wedding is classic, modern, romantic, or a blend of all three.',
      'We focus on creating floral designs that feel cohesive across every part of the day, from personal flowers to ceremony backdrops and reception tables.'
    ],
    servicesHeading: 'Wedding Floral Services in Providence',
    services: [
      'Bouquets, boutonnieres, and corsages',
      'Ceremony flowers and aisle arrangements',
      'Reception centerpieces and floral accents',
      'Large arrangements for entryways and bars',
      'Sweetheart table and cake table florals',
      'Custom floral styling for elegant city venues'
    ],
    venuesHeading: 'Ideal for Providence Wedding Venues',
    venuesIntro:
      'Our floral design style works especially well for Providence-area weddings held in:',
    venueList: [
      'Historic venues',
      'Downtown event spaces',
      'Ballroom receptions',
      'Industrial-chic wedding venues',
      'Private club and estate celebrations'
    ],
    faqHeading: 'Providence Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you design florals for city weddings in Providence?',
        answer:
          'Yes. We love working in Providence venues and design flowers that suit both historic and modern wedding settings.'
      },
      {
        question: 'Can you create a custom floral look for our venue?',
        answer:
          'Absolutely. Every wedding is designed around the couple, venue, season, and overall atmosphere they want to create.'
      },
      {
        question: 'Do you serve surrounding Providence areas?',
        answer:
          'Yes. We serve Providence and nearby areas throughout Rhode Island and New England.'
      }
    ],
    ctaHeading: 'Looking for a Providence Wedding Florist?',
    ctaText:
      'We would love to design florals that feel romantic, intentional, and tailored to your wedding day.'
  },
  {
    slug: 'bristol-ri-wedding-florist',
    city: 'Bristol',
    region: 'Bristol County',
    state: 'Rhode Island',
    title: 'Bristol RI Wedding Florist',
    metaTitle: 'Bristol RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/Marie&Brandon-11477.webp',
    heroAlt: 'Wedding flowers for a Bristol Rhode Island celebration',
    introHeading: 'Refined Wedding Florals for Bristol, Rhode Island',
    introText:
      'Black Begonia Florals creates wedding flowers for Bristol couples who want a floral design experience that feels intentional, romantic, and elevated. We design everything from bouquets and personal flowers to ceremony and reception florals.',
    whyHeading: 'Designed for Coastal and Historic Celebrations',
    whyParagraphs: [
      'Bristol weddings often bring together coastal charm, historic character, and timeless style. Our floral approach complements that balance, creating pieces that feel soft and artful while still polished and wedding-ready.',
      'We tailor each floral design to the venue, season, and mood of the celebration so every detail feels cohesive.'
    ],
    servicesHeading: 'Wedding Floral Services in Bristol',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Ceremony flowers and aisle accents',
      'Reception centerpieces and compote arrangements',
      'Statement florals for entry tables and bars',
      'Bud vase and candle styling',
      'Floral installations for tented weddings and waterfront venues'
    ],
    venuesHeading: 'Beautiful for Bristol Wedding Settings',
    venuesIntro:
      'Our florals are a great fit for weddings in and around Bristol, including:',
    venueList: [
      'Historic waterfront venues',
      'Private estate weddings',
      'Garden ceremonies',
      'Tented receptions',
      'Intimate coastal celebrations'
    ],
    faqHeading: 'Bristol Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you serve waterfront weddings in Bristol?',
        answer:
          'Yes. We design flowers for waterfront and coastal weddings throughout Bristol and the surrounding Rhode Island area.'
      },
      {
        question: 'Can you handle both ceremony and reception flowers?',
        answer:
          'Yes. We provide full wedding floral design from personal flowers through reception styling.'
      },
      {
        question: 'Do you work with couples from outside Rhode Island?',
        answer:
          'Yes. We work with local and destination couples planning weddings throughout New England.'
      }
    ],
    ctaHeading: 'Planning a Bristol Wedding?',
    ctaText:
      'We would love to create floral designs that feel artful, romantic, and seamlessly suited to your wedding setting.'
  },
  {
    slug: 'south-kingstown-ri-wedding-florist',
    city: 'South Kingstown',
    region: 'Washington County',
    state: 'Rhode Island',
    title: 'South Kingstown RI Wedding Florist',
    metaTitle: 'South Kingstown RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/472569059_1141950784170444_1745941425849176173_n.jpg',
    heroAlt: 'Romantic wedding florals for a South Kingstown Rhode Island wedding',
    introHeading: 'Wedding Flowers for South Kingstown and South County',
    introText:
      'Black Begonia Florals creates custom wedding flowers for South Kingstown couples who want their floral design to feel romantic, natural, and elevated. We design bouquets, ceremony flowers, and reception florals that feel personal to each celebration.',
    whyHeading: 'A Natural Fit for South County Weddings',
    whyParagraphs: [
      'South Kingstown weddings often feature a relaxed coastal feel paired with beautiful natural surroundings. Our floral work complements those settings with movement, texture, and intentional design choices that still feel refined.',
      'Whether your day is intimate and understated or full and expressive, we create florals that support the atmosphere you want guests to feel.'
    ],
    servicesHeading: 'Wedding Floral Services in South Kingstown',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Ceremony flowers and aisle florals',
      'Reception centerpieces and floral table styling',
      'Statement entry and welcome arrangements',
      'Floral accents for bars, cake tables, and lounge areas',
      'Custom floral design for coastal and tented weddings'
    ],
    venuesHeading: 'Ideal for South County Wedding Settings',
    venuesIntro:
      'Our floral designs work beautifully for South Kingstown weddings and nearby celebrations such as:',
    venueList: [
      'Coastal venues',
      'Backyard and private property weddings',
      'Barn and tented receptions',
      'Garden-inspired ceremonies',
      'Beach-adjacent celebrations'
    ],
    faqHeading: 'South Kingstown Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you serve South County weddings?',
        answer:
          'Yes. We serve South Kingstown and the greater South County area with custom wedding floral design.'
      },
      {
        question: 'Can you create flowers for beach or coastal weddings?',
        answer:
          'Yes. We love designing for coastal Rhode Island weddings and tailor each floral palette and style to the setting.'
      },
      {
        question: 'Do you offer full wedding floral design?',
        answer:
          'Yes. We offer bouquets, ceremony flowers, reception centerpieces, and larger floral moments depending on your needs.'
      }
    ],
    ctaHeading: 'Searching for a South Kingstown Wedding Florist?',
    ctaText:
      'We would love to hear more about your wedding and create florals that feel beautifully suited to your day.'
  },
  {
    slug: 'narragansett-ri-wedding-florist',
    city: 'Narragansett',
    region: 'Washington County',
    state: 'Rhode Island',
    title: 'Narragansett RI Wedding Florist',
    metaTitle: 'Narragansett RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/1000005137.jpg',
    heroAlt: 'Coastal wedding floral design in Narragansett Rhode Island',
    introHeading: 'Coastal Wedding Flowers for Narragansett Celebrations',
    introText:
      'Black Begonia Florals designs wedding flowers for Narragansett couples who want a floral experience that feels romantic, elevated, and naturally suited to the Rhode Island coast. From bouquets to ceremony flowers and reception centerpieces, each design is created with intention and artistry.',
    whyHeading: 'A Natural Fit for Narragansett Weddings',
    whyParagraphs: [
      'Narragansett weddings often call for flowers that feel soft, refined, and inspired by the coast without becoming overly thematic. We create florals that complement ocean views, tented receptions, beach-adjacent venues, and intimate celebrations with a polished editorial feel.',
      'Our goal is to create floral designs that feel beautiful in the setting, photograph well, and support the overall atmosphere you want guests to experience.'
    ],
    servicesHeading: 'Wedding Floral Services in Narragansett',
    services: [
      'Bridal bouquets and bridesmaid flowers',
      'Boutonnieres, corsages, and personal florals',
      'Ceremony flowers and altar arrangements',
      'Aisle markers and welcome arrangements',
      'Reception centerpieces and floral table styling',
      'Statement flowers for bars, escort displays, and sweetheart tables',
      'Floral design for coastal and tented weddings'
    ],
    venuesHeading: 'Beautiful for Narragansett Wedding Settings',
    venuesIntro:
      'Our floral style works beautifully for the kinds of wedding settings couples love in Narragansett, including:',
    venueList: [
      'Oceanfront wedding venues',
      'Beach-adjacent ceremonies',
      'Private property celebrations',
      'Tented coastal receptions',
      'Garden-inspired wedding spaces'
    ],
    faqHeading: 'Narragansett Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you design flowers for coastal weddings in Narragansett?',
        answer:
          'Yes. We love creating wedding flowers for Narragansett celebrations and tailor each floral design to fit the coastal setting in a refined and romantic way.'
      },
      {
        question: 'Can you provide both ceremony and reception flowers?',
        answer:
          'Yes. We offer full wedding floral design including bouquets, ceremony flowers, centerpieces, and larger floral installations.'
      },
      {
        question: 'Do you serve nearby South County wedding venues too?',
        answer:
          'Yes. We serve Narragansett and nearby South County areas throughout Rhode Island.'
      }
    ],
    ctaHeading: 'Planning a Narragansett Wedding?',
    ctaText:
      'We would love to create wedding flowers that feel romantic, artful, and perfectly suited to your Rhode Island celebration.'
  },
  {
    slug: 'westerly-ri-wedding-florist',
    city: 'Westerly',
    region: 'Washington County',
    state: 'Rhode Island',
    title: 'Westerly RI Wedding Florist',
    metaTitle: 'Westerly RI Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/487356093_1191780339618034_6096994124274989070_n.jpg',
    heroAlt: 'Elegant wedding flowers for a Westerly Rhode Island wedding',
    introHeading: 'Wedding Flowers for Westerly Celebrations',
    introText:
      'Black Begonia Florals creates wedding flowers for Westerly couples looking for florals that feel romantic, refined, and thoughtfully designed. We bring an editorial, garden-inspired approach to bouquets, ceremony flowers, and reception florals.',
    whyHeading: 'Designed for Coastal Rhode Island Weddings',
    whyParagraphs: [
      'Westerly weddings often combine coastal beauty with a relaxed but elevated atmosphere. Our floral style complements that balance with movement, texture, and carefully chosen blooms that feel elegant without feeling stiff.',
      'Whether your celebration is intimate or expansive, we create florals that feel cohesive, personal, and beautifully connected to the venue and season.'
    ],
    servicesHeading: 'Wedding Floral Services in Westerly',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Boutonnieres and personal flowers',
      'Ceremony florals and aisle accents',
      'Reception centerpieces and compote arrangements',
      'Statement arrangements for bars and welcome displays',
      'Sweetheart table and cake table flowers',
      'Floral design for coastal and estate weddings'
    ],
    venuesHeading: 'Perfect for Westerly Wedding Settings',
    venuesIntro:
      'Our floral work is especially well suited for Westerly-area celebrations such as:',
    venueList: [
      'Coastal wedding venues',
      'Private estate weddings',
      'Garden ceremonies',
      'Tented receptions',
      'Luxury inn and resort celebrations'
    ],
    faqHeading: 'Westerly Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you serve weddings in Westerly and nearby Watch Hill?',
        answer:
          'Yes. We serve Westerly, Watch Hill, and surrounding Rhode Island coastal wedding locations.'
      },
      {
        question: 'Can you design flowers for both small and large weddings?',
        answer:
          'Yes. We create floral designs for intimate celebrations as well as larger weddings needing full floral styling.'
      },
      {
        question: 'Do you offer full-service wedding florals?',
        answer:
          'Yes. We provide bouquets, ceremony flowers, reception centerpieces, and larger floral moments depending on your wedding needs.'
      }
    ],
    ctaHeading: 'Searching for a Westerly Wedding Florist?',
    ctaText:
      'We would love to design flowers that feel elevated, romantic, and beautifully tailored to your celebration.'
  },
  {
    slug: 'north-kingstown-ri-florist',
    city: 'North Kingstown',
    region: 'Washington County',
    state: 'Rhode Island',
    title: 'North Kingstown RI Florist',
    metaTitle: 'North Kingstown RI Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/481980239_1171057338357001_8346110190618749045_n.jpg',
    heroAlt: 'Custom floral design in North Kingstown Rhode Island',
    introHeading: 'Wedding and Event Florals for North Kingstown',
    introText:
      'Black Begonia Florals creates romantic, artful floral design for North Kingstown weddings and special events. Whether you are planning a wedding, celebration, or custom floral-forward event, we design flowers that feel elevated, intentional, and visually unforgettable.',
    whyHeading: 'Custom Floral Design with a Refined Feel',
    whyParagraphs: [
      'North Kingstown clients often look for flowers that feel elegant, personal, and thoughtfully composed. Our floral style blends movement, texture, and seasonal beauty to create designs that feel natural while still polished and event-ready.',
      'From wedding bouquets to event arrangements, our work is tailored to the occasion, setting, and atmosphere you want to create.'
    ],
    servicesHeading: 'Floral Services in North Kingstown',
    services: [
      'Wedding bouquets and personal flowers',
      'Ceremony and reception floral design',
      'Event centerpieces and floral styling',
      'Custom floral arrangements for celebrations',
      'Statement flowers for showers, dinners, and gatherings',
      'Seasonal floral design for special events'
    ],
    venuesHeading: 'Ideal for North Kingstown Events and Weddings',
    venuesIntro:
      'Our floral designs are a strong fit for North Kingstown and surrounding celebrations held in:',
    venueList: [
      'Private estates',
      'Backyard weddings',
      'Garden celebrations',
      'Historic venues',
      'Tented receptions and special events'
    ],
    faqHeading: 'North Kingstown Florist FAQ',
    faqs: [
      {
        question: 'Do you offer wedding flowers in North Kingstown?',
        answer:
          'Yes. We design wedding flowers in North Kingstown, including bouquets, ceremony flowers, reception florals, and custom floral styling.'
      },
      {
        question: 'Do you also provide florals for non-wedding events?',
        answer:
          'Yes. We provide floral design for a range of special events and celebrations depending on the project.'
      },
      {
        question: 'Do you serve nearby Rhode Island towns too?',
        answer:
          'Yes. We serve North Kingstown and surrounding Rhode Island areas as part of our broader New England service area.'
      }
    ],
    ctaHeading: 'Looking for a North Kingstown Florist?',
    ctaText:
      'We would love to hear more about your event and create florals that feel elegant, artistic, and beautifully tailored to the occasion.'
  },
  {
    slug: 'mystic-ct-wedding-florist',
    city: 'Mystic',
    region: 'New London County',
    state: 'Connecticut',
    title: 'Mystic CT Wedding Florist',
    metaTitle: 'Mystic CT Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/474588009_1154694492896073_5437394279938791591_n.jpg',
    heroAlt: 'Coastal wedding florals in Mystic Connecticut',
    introHeading: 'Coastal Wedding Flowers for Mystic Celebrations',
    introText:
      'Black Begonia Florals designs wedding flowers for Mystic couples who want florals that feel romantic, elevated, and naturally suited to the coastal New England atmosphere. We create bouquets, ceremony flowers, and reception florals with an editorial eye and a deeply personal approach.',
    whyHeading: 'Floral Design for Mystic Weddings',
    whyParagraphs: [
      'Mystic weddings often bring together waterfront charm, timeless New England character, and an intimate sense of place. Our floral work is designed to complement that style with movement, softness, and a refined finish.',
      'From personal flowers to larger installations, we create floral designs that feel cohesive and beautifully connected to your venue and celebration.'
    ],
    servicesHeading: 'Wedding Floral Services in Mystic',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Boutonnieres, corsages, and personal florals',
      'Ceremony arches and aisle flowers',
      'Reception centerpieces and floral styling',
      'Statement arrangements for bars and welcome spaces',
      'Custom floral design for waterfront weddings'
    ],
    venuesHeading: 'Beautiful for Mystic Wedding Settings',
    venuesIntro:
      'Our floral design style works beautifully for Mystic-area wedding settings such as:',
    venueList: [
      'Waterfront wedding venues',
      'Coastal inns and resorts',
      'Private property celebrations',
      'Tented weddings',
      'Historic New England venues'
    ],
    faqHeading: 'Mystic Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you serve coastal weddings in Mystic, Connecticut?',
        answer:
          'Yes. We serve Mystic weddings and create floral designs that complement waterfront and New England wedding settings beautifully.'
      },
      {
        question: 'Can you provide flowers for both ceremony and reception spaces?',
        answer:
          'Yes. We offer full wedding floral design including bouquets, ceremony florals, centerpieces, and larger floral moments.'
      },
      {
        question: 'Do you work across both Rhode Island and Connecticut?',
        answer:
          'Yes. We serve weddings throughout Rhode Island, Connecticut, and the broader New England area.'
      }
    ],
    ctaHeading: 'Planning a Mystic Wedding?',
    ctaText:
      'We would love to design wedding flowers that feel romantic, coastal, and beautifully aligned with your celebration.'
  },
  {
    slug: 'stonington-ct-wedding-florist',
    city: 'Stonington',
    region: 'New London County',
    state: 'Connecticut',
    title: 'Stonington CT Wedding Florist',
    metaTitle: 'Stonington CT Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/1000005233.jpg',
    heroAlt: 'Elegant wedding flowers for a Stonington Connecticut wedding',
    introHeading: 'Wedding Florals for Stonington Celebrations',
    introText:
      'Black Begonia Florals creates wedding flowers for Stonington couples who want a floral design experience that feels refined, romantic, and intentional. We design bouquets, ceremony flowers, and reception arrangements with a timeless New England sensibility.',
    whyHeading: 'Designed for Coastal Connecticut Weddings',
    whyParagraphs: [
      'Stonington weddings often blend historic charm, coastal beauty, and understated elegance. Our floral style complements those settings with garden-inspired movement, thoughtful palettes, and an elevated finish.',
      'We tailor each floral design to the venue, season, and atmosphere of the celebration so every floral detail feels cohesive.'
    ],
    servicesHeading: 'Wedding Floral Services in Stonington',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Boutonnieres and corsages',
      'Ceremony flowers and aisle florals',
      'Reception centerpieces and floral accents',
      'Statement flowers for entryways and bars',
      'Full floral styling for elegant New England weddings'
    ],
    venuesHeading: 'Perfect for Stonington Wedding Settings',
    venuesIntro:
      'Our floral work is ideal for Stonington-area celebrations such as:',
    venueList: [
      'Coastal wedding venues',
      'Historic inns and estates',
      'Private property weddings',
      'Tented receptions',
      'Garden and waterfront ceremonies'
    ],
    faqHeading: 'Stonington Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you serve weddings in Stonington, Connecticut?',
        answer:
          'Yes. We serve Stonington weddings and surrounding Connecticut coastal areas with custom floral design.'
      },
      {
        question: 'Can you provide flowers for full wedding days?',
        answer:
          'Yes. We create bouquets, ceremony flowers, reception centerpieces, and larger installations depending on your floral needs.'
      },
      {
        question: 'Do you also work in nearby Rhode Island?',
        answer:
          'Yes. We regularly serve weddings across both Rhode Island and Connecticut.'
      }
    ],
    ctaHeading: 'Searching for a Stonington Wedding Florist?',
    ctaText:
      'We would love to create floral designs that feel romantic, polished, and beautifully suited to your wedding day.'
  },
  {
    slug: 'boston-ma-wedding-florist',
    city: 'Boston',
    region: 'Suffolk County',
    state: 'Massachusetts',
    title: 'Boston MA Wedding Florist',
    metaTitle: 'Boston MA Wedding Florist | Black Begonia Florals',
    metaDescription:
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
    ],
    heroImage: 'assets/images/website/Madison&PatWedding_Details0025.jpg',
    heroAlt: 'Luxury wedding floral design in Boston Massachusetts',
    introHeading: 'Refined Wedding Flowers for Boston Celebrations',
    introText:
      'Black Begonia Florals creates wedding flowers for Boston couples who want their floral design to feel elevated, romantic, and editorial in style. We design bouquets, ceremony flowers, and reception florals that bring softness and artistry to elegant city celebrations.',
    whyHeading: 'Floral Design for Boston Weddings',
    whyParagraphs: [
      'Boston weddings often combine historic architecture, formal venues, modern style, and timeless celebration details. Our floral work is designed to complement that energy with intentional palettes, movement, and a refined visual balance.',
      'Whether your celebration is classic and luxurious or more modern and fashion-forward, we create florals that feel cohesive and deeply considered.'
    ],
    servicesHeading: 'Wedding Floral Services in Boston',
    services: [
      'Bridal bouquets and wedding party flowers',
      'Boutonnieres, corsages, and personal flowers',
      'Ceremony flowers and floral installations',
      'Reception centerpieces and elevated table florals',
      'Statement arrangements for bars, lounges, and entryways',
      'Custom floral styling for luxury wedding celebrations'
    ],
    venuesHeading: 'Beautiful for Boston Wedding Settings',
    venuesIntro:
      'Our floral style is a strong fit for many of the wedding settings couples choose in and around Boston, including:',
    venueList: [
      'Historic Boston venues',
      'Luxury hotel weddings',
      'Modern city event spaces',
      'Private estate celebrations',
      'Formal ballroom receptions'
    ],
    faqHeading: 'Boston Wedding Florist FAQ',
    faqs: [
      {
        question: 'Do you travel for weddings in Boston, Massachusetts?',
        answer:
          'Yes. We serve weddings throughout New England, including Boston and other Massachusetts celebrations.'
      },
      {
        question: 'Can you create flowers for luxury city weddings?',
        answer:
          'Yes. Our floral style is well suited for elevated city weddings with a romantic, editorial, and refined aesthetic.'
      },
      {
        question: 'Do you offer full-service wedding floral design?',
        answer:
          'Yes. We offer bouquets, ceremony flowers, reception centerpieces, and custom floral styling for full wedding days.'
      }
    ],
    ctaHeading: 'Planning a Boston Wedding?',
    ctaText:
      'We would love to create wedding flowers that feel artful, elevated, and beautifully aligned with your celebration.'
  }
];

export function getLocationPageBySlug(slug: string): LocationPageData | undefined {
  return LOCATION_PAGES.find((page) => page.slug === slug);
}