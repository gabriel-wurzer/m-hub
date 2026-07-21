import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AddDocumentDialogComponent } from './add-document-dialog.component';
import { FileType } from '../../../enums/file-type.enum';

describe('AddDocumentDialogComponent', () => {
  let component: AddDocumentDialogComponent;
  let fixture: ComponentFixture<AddDocumentDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddDocumentDialogComponent, NoopAnimationsModule]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddDocumentDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('routes a >25MB file to the resumable path (no base64, stays valid)', () => {
    component.name = 'Punktwolke';
    const big = new File([new ArrayBuffer(26 * 1024 * 1024)], 'cloud.e57');
    (component as unknown as { processFile: (f: File) => void }).processFile(big);

    expect(component.isResumable).toBeTrue();
    expect(component.selectedFileDataUrl).toBeNull();
    expect(component.selectedFileType).toBe(FileType.E57);
    expect(component.isFormValid()).toBeTrue();
  });

  it('rejects a file larger than 5 GB', () => {
    const huge = new File([], 'x.e57');
    Object.defineProperty(huge, 'size', { value: 6 * 1024 * 1024 * 1024 });
    (component as unknown as { processFile: (f: File) => void }).processFile(huge);

    expect(component.selectedFile).toBeNull();
    expect(component.getFileError()).toContain('zu groß');
  });

  it('confirmAddDocument emits a big-file result with null fileDataUrl but the raw File', () => {
    let closed: { fileDataUrl: string | null; file: File; fileType: FileType } | undefined;
    (component as unknown as { dialogRef: unknown }).dialogRef = { close: (r: typeof closed) => (closed = r) };

    component.name = 'Punktwolke';
    (component as unknown as { processFile: (f: File) => void }).processFile(
      new File([new ArrayBuffer(26 * 1024 * 1024)], 'cloud.e57')
    );
    component.confirmAddDocument();

    expect(closed).toBeTruthy();
    expect(closed!.fileDataUrl).toBeNull();
    expect(closed!.file).toBeTruthy();
    expect(closed!.fileType).toBe(FileType.E57);
  });
});
