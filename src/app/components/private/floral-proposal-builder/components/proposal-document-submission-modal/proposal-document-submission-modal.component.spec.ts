import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProposalDocumentSubmissionModalComponent } from './proposal-document-submission-modal.component';

describe('ProposalDocumentSubmissionModalComponent', () => {
  let component: ProposalDocumentSubmissionModalComponent;
  let fixture: ComponentFixture<ProposalDocumentSubmissionModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProposalDocumentSubmissionModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProposalDocumentSubmissionModalComponent);
    component = fixture.componentInstance;
  });

  it('renders nothing while closed and shows the manual PDF workflow when open', () => {
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('');

    component.open = true;
    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('Submit Signed Proposal PDF');
    expect(text).toContain('Manual PDF upload is the required submission path for this release.');
    expect(text).toContain('Canva import is optional and is not enabled in this workflow yet.');
  });

  it('emits close only when the modal is not saving', () => {
    const closeSpy = spyOn(component.closeModal, 'emit');

    component.onOverlayClose();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    component.saving = true;
    component.onOverlayClose();
    expect(closeSpy).toHaveBeenCalledTimes(1);
  });

  it('emits selected files from the input and drop handlers', () => {
    const fileSpy = spyOn(component.fileSelected, 'emit');
    const pdfFile = new File(['%PDF-test'], 'proposal.pdf', {
      type: 'application/pdf',
    });
    const input = {
      files: [pdfFile],
      value: 'C:\\fakepath\\proposal.pdf',
    } as unknown as HTMLInputElement;

    component.onFileInputChange({ target: input } as unknown as Event);
    expect(fileSpy).toHaveBeenCalledWith(pdfFile);
    expect(input.value).toBe('');

    const dragEvent = {
      preventDefault: jasmine.createSpy('preventDefault'),
      stopPropagation: jasmine.createSpy('stopPropagation'),
      dataTransfer: {
        files: [pdfFile],
      },
    } as unknown as DragEvent;

    component.onFileDrop(dragEvent);
    expect(fileSpy).toHaveBeenCalledWith(pdfFile);
  });

  it('shows selected file, errors, and optional canva copy when enabled', () => {
    component.open = true;
    component.fileName = 'proposal.pdf';
    component.canvaImportAvailable = true;
    component.errorMessage = 'Upload a valid PDF proposal document.';

    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('proposal.pdf');
    expect(text).toContain('Canva PDF import is available as an optional shortcut for completed designs.');
    expect(text).toContain('Upload a valid PDF proposal document.');
    expect(submitButton()?.disabled).toBeFalse();
  });

  it('shows progress and disables submission controls while finalization is running', () => {
    component.open = true;
    fixture.detectChanges();

    expect(submitButton()?.disabled).toBeFalse();
    expect(fixture.nativeElement.querySelector('[role="status"]')).toBeNull();

    component.saving = true;
    component.progressMessage = 'Uploading the signed proposal PDF securely...';
    fixture.detectChanges();

    expect(submitButton()?.disabled).toBeTrue();
    expect(textContent()).toContain('Uploading the signed proposal PDF securely...');
    expect(fixture.nativeElement.querySelector('[role="status"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('input[type="file"]')?.disabled).toBeTrue();
  });

  function textContent(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function submitButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button:last-of-type');
  }
});

