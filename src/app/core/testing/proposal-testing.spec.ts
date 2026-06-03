import {
  createBrowserPopupTestDouble,
  createCanvaPopupTestDouble,
  createImageFile,
  createPdfFile,
  createProposalStorageTestDouble,
} from './proposal-testing';

describe('proposal testing helpers', () => {
  it('creates browser popup doubles with printable document spies', () => {
    const popup = createBrowserPopupTestDouble();

    popup.document.open();
    popup.document.write('<html></html>');
    popup.document.close();
    popup.focus();
    popup.print();

    expect(popup.closed).toBeFalse();
    expect(popup.document.write).toHaveBeenCalledWith('<html></html>');
    expect(popup.focus).toHaveBeenCalled();
    expect(popup.print).toHaveBeenCalled();
  });

  it('creates Canva popup doubles with mutable navigation and messaging spies', () => {
    const popup = createCanvaPopupTestDouble();

    popup.location.assign('https://www.canva.com/design/next');
    popup.postMessage({ type: 'ready' }, '*');

    expect(popup.location.href).toBe('https://www.canva.com/design/next');
    expect(popup.postMessage).toHaveBeenCalledWith({ type: 'ready' }, '*');
  });

  it('creates storage doubles for upload, removal, signed URL, and public URL flows', async () => {
    const storage = createProposalStorageTestDouble('https://example.test/signed.png');

    await expectAsync(storage.upload('path', createImageFile())).toBeResolvedTo({
      data: { path: 'proposal-assets/test-file.png' },
      error: null,
    });
    await expectAsync(storage.remove(['path'])).toBeResolvedTo({
      data: [],
      error: null,
    });
    await expectAsync(storage.createSignedUrl('path', 60)).toBeResolvedTo({
      data: { signedUrl: 'https://example.test/signed.png' },
      error: null,
    });
    expect(storage.getPublicUrl('path')).toEqual({
      data: { publicUrl: 'https://example.test/signed.png' },
    });
  });

  it('creates synthetic proposal image and pdf files without real customer data', () => {
    const image = createImageFile('centerpiece.jpg', 'image/jpeg');
    const pdf = createPdfFile();

    expect(image.name).toBe('centerpiece.jpg');
    expect(image.type).toBe('image/jpeg');
    expect(pdf.name).toBe('proposal.pdf');
    expect(pdf.type).toBe('application/pdf');
  });
});
