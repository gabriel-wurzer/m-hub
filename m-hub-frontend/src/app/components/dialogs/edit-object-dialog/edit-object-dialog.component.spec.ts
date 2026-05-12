import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { EditObjectDialogComponent } from './edit-object-dialog.component';
import { BuildingComponentCategory } from '../../../enums/component-category';
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

describe('EditObjectDialogComponent', () => {
  let component: EditObjectDialogComponent;
  let fixture: ComponentFixture<EditObjectDialogComponent>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<EditObjectDialogComponent>>;

  beforeEach(async () => {
    dialogRefSpy = jasmine.createSpyObj<MatDialogRef<EditObjectDialogComponent>>('MatDialogRef', ['close']);

    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, EditObjectDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            object: {
              id: 'object-1',
              building_id: '5363852',
              user_building_id: 'user-building-1',
              owner_id: 'owner-1',
              category: BuildingComponentCategory.Objekt,
              name: 'Bestandsfenster',
              description: 'Objekt mit Abmessungen',
              object_type: ObjectType.Fenster,
              count: 3,
              length: 150,
              width: 95,
              height: 135,
              location: 'Regelgeschoss 1',
              is_public: true,
              is_hazardous: false
            }
          }
        },
        { provide: MatDialogRef, useValue: dialogRefSpy }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(EditObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should prefill measurements from the object data', () => {
    expect(component.length).toBe(150);
    expect(component.width).toBe(95);
    expect(component.height).toBe(135);
  });

  it('should show a number error and invalidate the form for bad measurement input', () => {
    component.height = 'asdf' as any;

    expect(component.getHeightError()).toBe('Höhe muss eine Zahl sein');
    expect(component.isFormValid()).toBeFalse();
  });

  it('should include measurements in the edit result', () => {
    component.confirmEditObject();

    expect(dialogRefSpy.close).toHaveBeenCalledWith(jasmine.objectContaining({
      name: 'Bestandsfenster',
      objectType: ObjectType.Fenster,
      number: 3,
      length: 150,
      width: 95,
      height: 135
    }));
  });

  it('commits mixed object image order with existing and new sort positions', () => {
    const newFile = new File(['new'], 'new.png', { type: 'image/png', lastModified: 3 });
    component.imageItems = [
      {
        kind: 'existing',
        key: 'existing:image-1',
        id: 'image-1',
        fileName: 'first.jpg',
        previewUrl: 'https://example.com/first.jpg',
        sortOrder: 0,
        sizeBytes: 10
      },
      {
        kind: 'existing',
        key: 'existing:image-2',
        id: 'image-2',
        fileName: 'second.jpg',
        previewUrl: 'https://example.com/second.jpg',
        sortOrder: 1,
        sizeBytes: 10
      },
      {
        kind: 'new',
        key: 'new:1:new.png:3:3',
        file: newFile,
        fileName: 'new.png',
        previewUrl: 'data:image/png;base64,new'
      }
    ] as any;

    const draggedImage = component.imageItems[2];
    const container = document.createElement('div');
    mockImageCard(container, mockRect(0, 0, 100, 80));
    const placeholder = mockImageCard(container, mockRect(120, 0, 100, 80), true);
    mockImageCard(container, mockRect(240, 0, 100, 80));

    component.startImageItemDrag({ source: { data: draggedImage } } as any);
    component.sortImageItemPreview({
      source: {
        data: draggedImage,
        dropContainer: { element: { nativeElement: container } },
        getPlaceholderElement: () => placeholder
      },
      pointerPosition: { x: 40, y: 40 }
    } as any);
    component.dropImageItem({ item: { data: draggedImage } } as any);
    component.confirmEditObject();

    const result = dialogRefSpy.close.calls.mostRecent().args[0] as any;
    expect(result.images.map((image: any) => ({ fileName: image.fileName, sortOrder: image.sortOrder }))).toEqual([
      { fileName: 'new.png', sortOrder: 0 }
    ]);
    expect(result.existingImageIds).toEqual(['image-1', 'image-2']);
    expect(result.existingImageOrders).toEqual([
      { id: 'image-1', sort_order: 1 },
      { id: 'image-2', sort_order: 2 }
    ]);
  });
});
