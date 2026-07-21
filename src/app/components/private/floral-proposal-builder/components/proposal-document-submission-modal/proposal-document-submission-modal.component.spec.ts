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
    component.depositEmailChoice = 'defer';

    fixture.detectChanges();

    const text = textContent();
    expect(text).toContain('proposal.pdf');
    expect(text).toContain('Canva PDF import is available as an optional shortcut for completed designs.');
    expect(text).toContain('Upload a valid PDF proposal document.');
    expect(submitButton()?.disabled).toBeFalse();
  });

  it('shows progress and disables submission controls while finalization is running', () => {
    component.open = true;
    component.fileName = 'proposal.pdf';
    component.depositEmailChoice = 'defer';
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

  it('submits a selected revision PDF without an extra acknowledgement', () => {
    const submitSpy = spyOn(component.submitDocument, 'emit');
    component.mode = 'project_revision';
    component.fileName = 'revision.pdf';
    component.onSubmit();
    expect(submitSpy).toHaveBeenCalledOnceWith(false);
  });

  it('requires an explicit send or defer decision for an initial conversion', () => {
    const submitSpy = spyOn(component.submitDocument, 'emit');
    component.fileName = 'proposal.pdf';

    component.onSubmit();
    expect(submitSpy).not.toHaveBeenCalled();

    component.depositEmailChoice = 'defer';
    component.onSubmit();
    expect(submitSpy).toHaveBeenCalledOnceWith(false);
  });

  it('applies the dark theme and keeps the modal within the viewport', () => {
    component.open = true;
    component.darkMode = true;
    fixture.detectChanges();

    const overlay = fixture.nativeElement.querySelector('.proposal-modal-overlay');
    const shell = fixture.nativeElement.querySelector('.proposal-modal-shell');
    const close = fixture.nativeElement.querySelector('.proposal-modal-close');
    expect(overlay.classList).toContain('crm-dark');
    expect(shell.className).toContain('max-h-[calc(100dvh-1.5rem)]');
    expect(close.className).toContain('rounded-full');
    expect(textContent()).not.toContain('I confirm this PDF');
  });

  it('renders revision-specific activation copy without initial booking language', () => {
    component.open = true;
    component.mode = 'project_revision';
    fixture.detectChanges();
    expect(textContent()).toContain('Activate Revised Proposal PDF');
    expect(textContent()).toContain('keeps the prior version as immutable history');
    expect(textContent()).not.toContain('books the project');
  });

  function textContent(): string {
    return fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim();
  }

  function submitButton(): HTMLButtonElement | null {
    return fixture.nativeElement.querySelector('button:last-of-type');
  }
});

