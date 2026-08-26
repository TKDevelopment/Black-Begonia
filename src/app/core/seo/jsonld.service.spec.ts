import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { JsonLdService, WorkshopEventSchemaInput } from './jsonld.service';

describe('JsonLdService', () => {
  let service: JsonLdService;
  let document: Document;
  const eventInput: WorkshopEventSchemaInput = {
    name: 'Summer Flowers',
    description: 'Arrange seasonal flowers.',
    url: 'https://blackbegoniaflorals.com/workshops/summer-flowers',
    startDate: '2026-08-14T18:00:00-04:00',
    endDate: '2026-08-14T20:00:00-04:00',
    status: 'scheduled',
    images: ['https://cdn.example.test/hero.webp'],
    venueName: 'The Flower Room',
    streetAddress: '100 Flower Lane',
    locality: 'Richmond',
    region: 'RI',
    postalCode: '02892',
    country: 'US',
    priceMinor: 8500,
    currency: 'USD',
    availability: 'available',
    validFrom: '2026-07-01T12:00:00Z',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(JsonLdService);
    document = TestBed.inject(DOCUMENT);
  });

  afterEach(() => {
    document.querySelectorAll("script[id^='schema-']").forEach((element) => element.remove());
  });

  function schema(): any {
    return JSON.parse(document.getElementById('schema-workshop-event')!.textContent!);
  }

  it('publishes the canonical Instagram account in local business structured data', () => {
    service.setLocalBusiness();
    const localBusiness = JSON.parse(document.getElementById('schema-local-business')!.textContent!);
    expect(localBusiness.sameAs).toContain('https://www.instagram.com/blackbegoniaflorals/');
  });

  it('publishes scheduled Event facts with offsets, venue, organizer, and offer', () => {
    service.setWorkshopEvent(eventInput);
    expect(schema()).toEqual(jasmine.objectContaining({
      startDate: '2026-08-14T18:00:00-04:00',
      eventStatus: 'https://schema.org/EventScheduled',
      organizer: jasmine.objectContaining({ name: 'Black Begonia Florals' }),
      offers: jasmine.objectContaining({
        price: '85.00',
        availability: 'https://schema.org/InStock',
        validFrom: '2026-07-01T12:00:00Z',
      }),
    }));
    expect(schema().location.address).toEqual(jasmine.objectContaining({
      streetAddress: '100 Flower Lane',
      addressRegion: 'RI',
    }));
  });

  it('maps sold-out and completed occurrences to scheduled events with unavailable offers', () => {
    service.setWorkshopEvent({ ...eventInput, availability: 'sold_out' });
    expect(schema().eventStatus).toBe('https://schema.org/EventScheduled');
    expect(schema().offers.availability).toBe('https://schema.org/SoldOut');

    service.setWorkshopEvent({ ...eventInput, availability: 'closed' });
    expect(schema().eventStatus).toBe('https://schema.org/EventScheduled');
    expect(schema().offers.availability).toBe('https://schema.org/SoldOut');
  });

  it('publishes cancelled events without changing their original dates', () => {
    service.setWorkshopEvent({ ...eventInput, status: 'cancelled' });
    expect(schema().eventStatus).toBe('https://schema.org/EventCancelled');
    expect(schema().startDate).toBe(eventInput.startDate);
  });

  it('publishes rescheduled replacement dates and the previous start date', () => {
    service.setWorkshopEvent({
      ...eventInput,
      status: 'rescheduled',
      previousStartDate: eventInput.startDate,
      startDate: '2026-08-21T18:00:00-04:00',
      endDate: '2026-08-21T20:00:00-04:00',
    });
    expect(schema().eventStatus).toBe('https://schema.org/EventRescheduled');
    expect(schema().previousStartDate).toBe(eventInput.startDate);
    expect(schema().startDate).toBe('2026-08-21T18:00:00-04:00');
  });

  it('removes workshop Event markup during page cleanup', () => {
    service.setWorkshopEvent(eventInput);
    service.clearPageSchemas();
    expect(document.getElementById('schema-workshop-event')).toBeNull();
  });
});
