export interface BrowserPopupTestDouble {
  document: {
    open: jasmine.Spy;
    write: jasmine.Spy;
    close: jasmine.Spy;
  };
  focus: jasmine.Spy;
  print: jasmine.Spy;
  close: jasmine.Spy;
  closed: boolean;
}

export interface CanvaPopupTestDouble extends BrowserPopupTestDouble {
  postMessage: jasmine.Spy;
  location: {
    href: string;
    assign: jasmine.Spy;
  };
}

export interface ProposalStorageTestDouble {
  upload: jasmine.Spy;
  remove: jasmine.Spy;
  createSignedUrl: jasmine.Spy;
  getPublicUrl: jasmine.Spy;
}

export function createBrowserPopupTestDouble(): BrowserPopupTestDouble {
  return {
    document: {
      open: jasmine.createSpy('document.open'),
      write: jasmine.createSpy('document.write'),
      close: jasmine.createSpy('document.close'),
    },
    focus: jasmine.createSpy('focus'),
    print: jasmine.createSpy('print'),
    close: jasmine.createSpy('close'),
    closed: false,
  };
}

export function createCanvaPopupTestDouble(
  href = 'https://www.canva.com/design/test'
): CanvaPopupTestDouble {
  const popup = createBrowserPopupTestDouble() as CanvaPopupTestDouble;
  popup.postMessage = jasmine.createSpy('postMessage');
  popup.location = {
    href,
    assign: jasmine.createSpy('location.assign').and.callFake((nextHref: string) => {
      popup.location.href = nextHref;
    }),
  };
  return popup;
}

export function createProposalStorageTestDouble(
  signedUrl = 'https://example.test/signed-proposal-asset'
): ProposalStorageTestDouble {
  return {
    upload: jasmine.createSpy('upload').and.resolveTo({
      data: { path: 'proposal-assets/test-file.png' },
      error: null,
    }),
    remove: jasmine.createSpy('remove').and.resolveTo({
      data: [],
      error: null,
    }),
    createSignedUrl: jasmine.createSpy('createSignedUrl').and.resolveTo({
      data: { signedUrl },
      error: null,
    }),
    getPublicUrl: jasmine.createSpy('getPublicUrl').and.returnValue({
      data: { publicUrl: signedUrl },
    }),
  };
}

export function createImageFile(
  name = 'proposal-image.png',
  type = 'image/png'
): File {
  return new File(['synthetic proposal image'], name, { type });
}

export function createPdfFile(name = 'proposal.pdf'): File {
  return new File(['%PDF-1.4 synthetic'], name, { type: 'application/pdf' });
}
