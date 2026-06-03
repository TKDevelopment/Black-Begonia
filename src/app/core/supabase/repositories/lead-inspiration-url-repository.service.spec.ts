import { TestBed } from '@angular/core/testing';

import { LeadInspirationUrl } from '../../models/lead-inspiration-url';
import { SupabaseService } from '../clients/supabase.service';
import { LeadInspirationUrlRepositoryService } from './lead-inspiration-url-repository.service';

describe('LeadInspirationUrlRepositoryService', () => {
  let service: LeadInspirationUrlRepositoryService;
  let supabaseService: jasmine.SpyObj<SupabaseService>;
  let client: {
    from: jasmine.Spy;
    storage: {
      from: jasmine.Spy;
    };
  };
  let consoleErrorSpy: jasmine.Spy;

  const inspiration: LeadInspirationUrl = {
    lead_inspiration_url_id: 'inspiration-1',
    lead_id: 'lead-1',
    url: 'https://example.test/storage/v1/object/public/lead-inspiration-photos/lead-1/photo-one.jpg',
    created_at: '2026-06-02T10:00:00.000Z',
  };

  beforeEach(() => {
    client = {
      from: jasmine.createSpy('from'),
      storage: {
        from: jasmine.createSpy('storage.from'),
      },
    };
    supabaseService = jasmine.createSpyObj<SupabaseService>('SupabaseService', [
      'getClient',
    ]);
    supabaseService.getClient.and.returnValue(client as never);

    TestBed.configureTestingModule({
      providers: [
        LeadInspirationUrlRepositoryService,
        { provide: SupabaseService, useValue: supabaseService },
      ],
    });

    service = TestBed.inject(LeadInspirationUrlRepositoryService);
    consoleErrorSpy = spyOn(console, 'error');
  });

  it('loads inspiration URLs for a lead newest first', async () => {
    const query = createSelectEqOrderQuery({ data: [inspiration], error: null });
    client.from.and.returnValue(query);

    const urls = await service.getInspirationUrlsByLeadId('lead-1');

    expect(client.from).toHaveBeenCalledWith('lead_inspiration_urls');
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('lead_inspiration_url_id'));
    expect(query.eq).toHaveBeenCalledWith('lead_id', 'lead-1');
    expect(query.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(urls).toEqual([inspiration]);
  });

  it('returns an empty list when no inspiration URLs exist', async () => {
    client.from.and.returnValue(createSelectEqOrderQuery({ data: null, error: null }));

    const urls = await service.getInspirationUrlsByLeadId('lead-1');

    expect(urls).toEqual([]);
  });

  it('returns an empty list and logs when loading inspiration URLs fails', async () => {
    const error = new Error('select failed');
    client.from.and.returnValue(createSelectEqOrderQuery({ data: null, error }));

    const urls = await service.getInspirationUrlsByLeadId('lead-1');

    expect(urls).toEqual([]);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadInspirationUrlRepositoryService] getInspirationUrlsByLeadId error:',
      error
    );
  });

  it('uploads an inspiration photo and saves its public URL', async () => {
    spyOn(Date, 'now').and.returnValue(1_780_000_000_000);
    const file = new File(['image'], ' My Inspiration!.JPG ', { type: 'image/jpeg' });
    const bucket = createStorageBucket({ uploadError: null });
    const query = createInsertSelectSingleQuery({ data: inspiration, error: null });
    client.storage.from.and.returnValue(bucket);
    client.from.and.returnValue(query);

    const saved = await service.uploadInspirationPhoto('lead-1', file);

    expect(client.storage.from).toHaveBeenCalledWith('lead-inspiration-photos');
    expect(bucket.upload).toHaveBeenCalledWith(
      'lead-1/1780000000000-my-inspiration-.jpg',
      file,
      {
        cacheControl: '3600',
        upsert: false,
      }
    );
    expect(bucket.getPublicUrl).toHaveBeenCalledWith(
      'lead-1/1780000000000-my-inspiration-.jpg'
    );
    expect(query.insert).toHaveBeenCalledWith({
      lead_id: 'lead-1',
      url: 'https://example.test/storage/v1/object/public/lead-inspiration-photos/lead-1/1780000000000-my-inspiration-.jpg',
    });
    expect(query.select).toHaveBeenCalledWith(jasmine.stringMatching('url'));
    expect(saved).toEqual(inspiration);
  });

  it('throws a friendly error when photo upload fails', async () => {
    const uploadError = new Error('storage unavailable');
    client.storage.from.and.returnValue(createStorageBucket({ uploadError }));

    await expectAsync(
      service.uploadInspirationPhoto(
        'lead-1',
        new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
      )
    ).toBeRejectedWithError('We could not upload the inspiration photo right now.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadInspirationUrlRepositoryService] uploadInspirationPhoto upload error:',
      uploadError
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws a friendly error when uploaded photo URL cannot be saved', async () => {
    const insertError = new Error('insert failed');
    client.storage.from.and.returnValue(createStorageBucket({ uploadError: null }));
    client.from.and.returnValue(
      createInsertSelectSingleQuery({ data: null, error: insertError })
    );

    await expectAsync(
      service.uploadInspirationPhoto(
        'lead-1',
        new File(['image'], 'photo.jpg', { type: 'image/jpeg' })
      )
    ).toBeRejectedWithError('The photo uploaded, but we could not save its link.');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadInspirationUrlRepositoryService] uploadInspirationPhoto insert error:',
      insertError
    );
  });

  it('deletes the storage object and inspiration URL row', async () => {
    const bucket = createStorageBucket({ removeError: null });
    const query = createDeleteEqQuery({ error: null });
    client.storage.from.and.returnValue(bucket);
    client.from.and.returnValue(query);

    await service.deleteInspirationPhoto(inspiration);

    expect(bucket.remove).toHaveBeenCalledWith(['lead-1/photo-one.jpg']);
    expect(client.from).toHaveBeenCalledWith('lead_inspiration_urls');
    expect(query.delete).toHaveBeenCalled();
    expect(query.eq).toHaveBeenCalledWith(
      'lead_inspiration_url_id',
      'inspiration-1'
    );
  });

  it('throws when the storage path cannot be parsed from the URL', async () => {
    await expectAsync(
      service.deleteInspirationPhoto({
        ...inspiration,
        url: 'https://example.test/not-the-storage-bucket/photo.jpg',
      })
    ).toBeRejectedWithError('We could not determine which storage file to delete.');
    expect(client.storage.from).not.toHaveBeenCalled();
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws a friendly error when storage removal fails', async () => {
    const storageError = new Error('remove failed');
    client.storage.from.and.returnValue(createStorageBucket({ removeError: storageError }));

    await expectAsync(service.deleteInspirationPhoto(inspiration)).toBeRejectedWithError(
      'We could not delete the inspiration photo from storage.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadInspirationUrlRepositoryService] deleteInspirationPhoto storage error:',
      storageError
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it('throws a friendly error when the URL row cannot be deleted', async () => {
    const rowError = new Error('delete failed');
    client.storage.from.and.returnValue(createStorageBucket({ removeError: null }));
    client.from.and.returnValue(createDeleteEqQuery({ error: rowError }));

    await expectAsync(service.deleteInspirationPhoto(inspiration)).toBeRejectedWithError(
      'The photo was removed from storage, but the CRM link could not be deleted.'
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[LeadInspirationUrlRepositoryService] deleteInspirationPhoto row error:',
      rowError
    );
  });
});

function createSelectEqOrderQuery(result: unknown) {
  const query = {
    select: jasmine.createSpy('select'),
    eq: jasmine.createSpy('eq'),
    order: jasmine.createSpy('order'),
  };
  query.select.and.returnValue(query);
  query.eq.and.returnValue(query);
  query.order.and.resolveTo(result);
  return query;
}

function createInsertSelectSingleQuery(result: unknown) {
  const query = {
    insert: jasmine.createSpy('insert'),
    select: jasmine.createSpy('select'),
    single: jasmine.createSpy('single'),
  };
  query.insert.and.returnValue(query);
  query.select.and.returnValue(query);
  query.single.and.resolveTo(result);
  return query;
}

function createDeleteEqQuery(result: unknown) {
  const query = {
    delete: jasmine.createSpy('delete'),
    eq: jasmine.createSpy('eq'),
  };
  query.delete.and.returnValue(query);
  query.eq.and.resolveTo(result);
  return query;
}

function createStorageBucket({
  uploadError = null,
  removeError = null,
}: {
  uploadError?: Error | null;
  removeError?: Error | null;
}) {
  return {
    upload: jasmine.createSpy('upload').and.resolveTo({ error: uploadError }),
    remove: jasmine.createSpy('remove').and.resolveTo({ error: removeError }),
    getPublicUrl: jasmine.createSpy('getPublicUrl').and.callFake((path: string) => ({
      data: {
        publicUrl: `https://example.test/storage/v1/object/public/lead-inspiration-photos/${path}`,
      },
    })),
  };
}
