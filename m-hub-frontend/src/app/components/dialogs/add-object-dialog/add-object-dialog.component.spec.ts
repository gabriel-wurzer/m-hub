import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { AddObjectDialogComponent } from './add-object-dialog.component';
import { ObjectType } from '../../../enums/object-type';

function mockImageCard(container: HTMLElement, rect: DOMRect, isPlaceholder = false): HTMLElement {
  const card = document.createElement('div');
  card.classList.add('sortable-image-card');
  if (isPlaceholder) {
    card.classList.add('cdk-drag-placeholder');
  }
  spyOn(card, 'getBoundingClientRect').and.returnValue(rect);
  container.appendChild(card);
  return card;
}

function mockRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    toJSON: () => ({})
  } as DOMRect;
}

describe('AddObjectDialogComponent', () => {
  let component: AddObjectDialogComponent;
  let fixture: ComponentFixture<AddObjectDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<AddObjectDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<AddObjectDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, AddObjectDialogComponent],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: null },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AddObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should consider optional measurements in form validity', () => {
    component.name = 'Türblatt';
    component.objectType = ObjectType.Fenster;
    component.number = 1;
    component.length = 120;
    component.width = 0;
    component.height = 210;

    expect(component.isFormValid()).toBeFalse();

    component.width = 80;

    expect(component.isFormValid()).toBeTrue();
  });

  it('should show a number error and invalidate the form for bad measurement input', () => {
    component.name = 'Fenster';
    component.objectType = ObjectType.Fenster;
    component.number = 1;
    component.length = '123asd' as any;

    expect(component.getLengthError()).toBe('Länge muss eine Zahl sein');
    expect(component.isFormValid()).toBeFalse();
  });

  it('should include measurements in the dialog result', () => {
    component.name = 'Fenster';
    component.objectType = ObjectType.Fenster;
    component.number = 2;
    component.length = 140;
    component.width = 90;
    component.height = 130;

    component.confirmAddObject();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Fenster',
      objectType: ObjectType.Fenster,
      number: 2,
      length: 140,
      width: 90,
      height: 130
    }));
  });

  it('commits the selected image order from the live drag placeholder position', () => {
    const firstFile = new File(['first'], 'first.png', { type: 'image/png', lastModified: 1 });
    const secondFile = new File(['second'], 'second.png', { type: 'image/png', lastModified: 2 });
    const thirdFile = new File(['third'], 'third.png', { type: 'image/png', lastModified: 3 });
    const firstImage = { file: firstFile, fileName: 'first.png', previewUrl: 'data:image/png;base64,first' };

    component.selectedImages = [
      firstImage,
      { file: secondFile, fileName: 'second.png', previewUrl: 'data:image/png;base64,second' },
      { file: thirdFile, fileName: 'third.png', previewUrl: 'data:image/png;base64,third' }
    ];

    const container = document.createElement('div');
    const placeholder = mockImageCard(container, mockRect(0, 0, 100, 80), true);
    mockImageCard(container, mockRect(120, 0, 100, 80));
    mockImageCard(container, mockRect(240, 0, 100, 80));

    component.startSelectedImageDrag({ source: { data: firstImage } } as any);
    component.sortSelectedImagePreview({
      source: {
        data: firstImage,
        dropContainer: { element: { nativeElement: container } },
        getPlaceholderElement: () => placeholder
      },
      pointerPosition: { x: 380, y: 40 }
    } as any);
    component.dropSelectedImage({ item: { data: firstImage } } as any);

    expect(container.lastElementChild).toBe(placeholder);
    expect(component.selectedImages.map((image) => image.fileName)).toEqual(['second.png', 'third.png', 'first.png']);
  });
});
