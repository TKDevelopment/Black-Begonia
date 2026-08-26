import { TestBed } from '@angular/core/testing';

import { SupabaseService } from '../clients/supabase.service';
import { WorkshopMediaService } from './workshop-media.service';

describe('WorkshopMediaService', () => {
  let service: WorkshopMediaService;
  let client: {
    storage: { from: jasmine.Spy };
    from: jasmine.Spy;
  };
  let bucket: {
    upload: jasmine.Spy;
    remove: jasmine.Spy;
    getPublicUrl: jasmine.Spy;
  };

  beforeEach(() => {
    bucket = {
      upload: jasmine.createSpy('upload').and.resolveTo({ data: { path: 'definitions/d/hero.webp' }, error: null }),
      remove: jasmine.createSpy('remove').and.resolveTo({ data: [], error: null }),
      getPublicUrl: jasmine.createSpy('getPublicUrl').and.returnValue({
        data: { publicUrl: 'https://example.test/storage/hero.webp' },
      }),
    };
    client = {
      storage: { from: jasmine.createSpy('storage.from').and.returnValue(bucket) },
      from: jasmine.createSpy('from'),
    };
    const supabase = jasmine.createSpyObj<SupabaseService>('SupabaseService', ['getClient']);
    supabase.getClient.and.returnValue(client as never);
    TestBed.configureTestingModule({
      providers: [WorkshopMediaService, { provide: SupabaseService, useValue: supabase }],
    });
    service = TestBed.inject(WorkshopMediaService);
  });

  it('rejects oversized, unsupported, or inaccessible images', () => {
    const bad = new File(['x'], 'hero.gif', { type: 'image/gif' });
    Object.defineProperty(bad, 'size', { value: 11 * 1024 * 1024 });

    expect(service.validateImage(bad, '')).toEqual([
      'Choose a JPEG, PNG, WebP, or AVIF image.',
      'Images must be 10 MB or smaller.',
      'Alternative text is required.',
    ]);
  });

  it('uploads ordered public media with alternative text', async () => {
    const insert = insertResult({ workshop_media_id: 'media-1' });
    client.from.and.returnValue(insert);
    const file = new File(['image'], 'hero.webp', { type: 'image/webp' });

    await service.upload({
      owner: { definitionId: 'definition-1' },
      role: 'hero',
      file,
      altText: 'Seasonal centerpiece',
      displayOrder: 0,
      width: 1600,
      height: 1000,
    });

    expect(client.storage.from).toHaveBeenCalledWith('workshop-media');
    expect(insert.insert).toHaveBeenCalledWith(jasmine.objectContaining({
      media_role: 'hero',
      alt_text: 'Seasonal centerpiece',
      is_public: true,
      display_order: 0,
    }));
  });

  it('removes an uploaded object when metadata persistence fails', async () => {
    const insert = insertResult(null, new Error('metadata failed'));
    client.from.and.returnValue(insert);
    const file = new File(['image'], 'hero.webp', { type: 'image/webp' });

    await expectAsync(service.upload({
      owner: { occurrenceId: 'occurrence-1' },
      role: 'gallery',
      file,
      altText: 'Flowers on the worktable',
      displayOrder: 2,
      width: 1000,
      height: 1000,
    })).toBeRejected();

    expect(bucket.remove).toHaveBeenCalled();
  });

  it('never allows receipt evidence paths into the public media bucket', () => {
    expect(() => service.assertPublicMediaPath('workshop-receipts/receipt.pdf'))
      .toThrowError(/receipt/i);
  });

  it('uploads a replacement before removing the prior public image', async () => {
    const existing = {
      workshop_media_id: 'media-old',
      storage_path: 'definitions/definition-1/hero-old.webp',
    };
    const replacement = { workshop_media_id: 'media-new' };
    spyOn(service, 'upload').and.resolveTo(replacement as never);
    spyOn(service, 'remove').and.resolveTo();

    const result = await service.replace(existing as never, {
      owner: { definitionId: 'definition-1' },
      role: 'hero',
      file: new File(['image'], 'hero.webp', { type: 'image/webp' }),
      altText: 'A finished seasonal arrangement',
      displayOrder: 0,
      width: 1600,
      height: 1000,
    });

    expect(result).toBe(replacement as never);
    expect(service.upload).toHaveBeenCalledBefore(service.remove);
    expect(service.remove).toHaveBeenCalledWith(existing as never);
  });
});

function insertResult(data: unknown, error: Error | null = null) {
  const query = {
    insert: jasmine.createSpy('insert'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.insert.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo({ data, error });
  return query;
}
