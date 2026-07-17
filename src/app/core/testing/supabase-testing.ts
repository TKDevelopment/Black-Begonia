export interface SupabaseQueryResponse<T> {
  data: T | null;
  error: Error | null;
}

export function supabaseSuccess<T>(data: T): SupabaseQueryResponse<T> {
  return { data, error: null };
}

export function supabaseFailure<T = never>(message = 'Synthetic Supabase failure'): SupabaseQueryResponse<T> {
  return { data: null, error: new Error(message) };
}

export function createSupabaseQueryMock<T>(response: SupabaseQueryResponse<T>) {
  const query: Record<string, unknown> = {
    maybeSingle: jasmine.createSpy('maybeSingle').and.resolveTo(response),
    single: jasmine.createSpy('single').and.resolveTo(response),
    then: (resolve: (value: SupabaseQueryResponse<T>) => unknown) => Promise.resolve(response).then(resolve),
  };

  for (const method of ['select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'in', 'order', 'limit']) {
    query[method] = jasmine.createSpy(method).and.returnValue(query);
  }

  return query;
}

export type SupabaseQueryChain<T> = {
  select: jasmine.Spy;
  insert: jasmine.Spy;
  update: jasmine.Spy;
  delete: jasmine.Spy;
  upsert: jasmine.Spy;
  eq: jasmine.Spy;
  neq: jasmine.Spy;
  in: jasmine.Spy;
  order: jasmine.Spy;
  limit: jasmine.Spy;
  single: jasmine.Spy;
  maybeSingle: jasmine.Spy;
  then: (resolve: (value: SupabaseQueryResponse<T>) => unknown) => Promise<unknown>;
};

export function createSupabaseQueryChain<T>(
  response: SupabaseQueryResponse<T>
): SupabaseQueryChain<T> {
  const query = {} as SupabaseQueryChain<T>;
  const chainMethods: Array<keyof Omit<SupabaseQueryChain<T>, 'then'>> = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'order',
    'limit',
  ];

  for (const method of chainMethods) {
    query[method] = jasmine.createSpy(method).and.returnValue(query);
  }

  query.single = jasmine.createSpy('single').and.resolveTo(response);
  query.maybeSingle = jasmine.createSpy('maybeSingle').and.resolveTo(response);
  query.then = (resolve: (value: SupabaseQueryResponse<T>) => unknown) =>
    Promise.resolve(response).then(resolve);

  return query;
}

export function createSupabaseClientWithQuery<T>(
  response: SupabaseQueryResponse<T>,
  query = createSupabaseQueryChain(response)
) {
  return {
    client: {
      from: jasmine.createSpy('from').and.returnValue(query),
    },
    query,
  };
}

export function createSupabaseClientMock<T>(response: SupabaseQueryResponse<T>) {
  return {
    from: jasmine.createSpy('from').and.returnValue(createSupabaseQueryMock(response)),
    auth: {
      getSession: jasmine.createSpy('getSession').and.resolveTo({ data: { session: null }, error: null }),
      getUser: jasmine.createSpy('getUser').and.resolveTo({ data: { user: null }, error: null }),
      signInWithPassword: jasmine.createSpy('signInWithPassword').and.resolveTo(response),
      signOut: jasmine.createSpy('signOut').and.resolveTo({ error: null }),
      onAuthStateChange: jasmine
        .createSpy('onAuthStateChange')
        .and.returnValue({ data: { subscription: { unsubscribe: jasmine.createSpy('unsubscribe') } } }),
    },
    storage: {
      from: jasmine.createSpy('storage.from').and.returnValue({
        upload: jasmine.createSpy('upload').and.resolveTo(response),
        createSignedUrl: jasmine.createSpy('createSignedUrl').and.resolveTo(response),
        getPublicUrl: jasmine.createSpy('getPublicUrl').and.returnValue({ data: { publicUrl: 'https://example.test/file.pdf' } }),
      }),
    },
    functions: {
      invoke: jasmine.createSpy('invoke').and.resolveTo(response),
    },
  };
}
