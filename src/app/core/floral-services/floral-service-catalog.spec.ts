import {
  FLORAL_SERVICE_CATALOG,
  FLORAL_SERVICE_DATABASE_VALUES,
  resolveFloralServiceDatabaseValue,
  resolveFloralServiceLabel,
} from './floral-service-catalog';

describe('floral service catalog', () => {
  it('maps every CRM display label to a valid Supabase enum value', () => {
    for (const service of FLORAL_SERVICE_CATALOG) {
      expect(FLORAL_SERVICE_DATABASE_VALUES).toContain(service.databaseValue);
      expect(resolveFloralServiceDatabaseValue(service.label, service.eventType))
        .withContext(service.label)
        .toBe(service.databaseValue);
    }
  });

  it('maps public wedding service keys and labels to Supabase enum values', () => {
    expect(resolveFloralServiceDatabaseValue('wedding-full-service', 'wedding')).toBe(
      'full-service wedding'
    );
    expect(resolveFloralServiceDatabaseValue('Full-Service Wedding', 'wedding')).toBe(
      'full-service wedding'
    );
    expect(resolveFloralServiceDatabaseValue('Ceremony-Only Wedding', 'wedding')).toBe(
      'ceremony-only wedding'
    );
  });

  it('maps public general service labels to Supabase enum values', () => {
    expect(resolveFloralServiceDatabaseValue('Baby Showers', 'general')).toBe(
      'baby shower'
    );
    expect(resolveFloralServiceDatabaseValue('Corporate Events', 'general')).toBe(
      'corporate'
    );
    expect(resolveFloralServiceDatabaseValue('Private Lessons', 'general')).toBe(
      'private lessons'
    );
  });

  it('keeps direct Supabase enum values unchanged', () => {
    for (const value of FLORAL_SERVICE_DATABASE_VALUES) {
      expect(resolveFloralServiceDatabaseValue(value)).withContext(value).toBe(value);
    }
  });

  it('routes catalog offerings without one-to-one enum entries to accepted values', () => {
    expect(
      resolveFloralServiceDatabaseValue('Build-Your-Own Flower Bar', 'general')
    ).toBe('private event');
    expect(
      resolveFloralServiceDatabaseValue('Quinceanera Celebrations', 'general')
    ).toBe('private event');
  });

  it('still resolves stored enum values back to display labels for CRM editing', () => {
    expect(resolveFloralServiceLabel('full-service wedding', 'wedding')).toBe(
      'Full-Service Wedding'
    );
    expect(resolveFloralServiceLabel('baby shower', 'general')).toBe(
      'Baby Showers'
    );
  });
});
