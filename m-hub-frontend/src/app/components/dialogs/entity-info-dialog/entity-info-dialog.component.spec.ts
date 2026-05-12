import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ConnectionType } from '../../../enums/connection-type.enum';
import { PartType } from '../../../enums/part-type.enum';
import { EntityInfoDialogComponent } from './entity-info-dialog.component';

describe('EntityInfoDialogComponent', () => {
  let component: EntityInfoDialogComponent;
  let fixture: ComponentFixture<EntityInfoDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EntityInfoDialogComponent],
      providers: [
        {
          provide: MAT_DIALOG_DATA,
          useValue: {
            entity: {
              id: 'part-1',
              name: 'Außenwand Nord',
              part_type: PartType.AW,
              description: 'Teststruktur',
              is_hazardous: false,
              is_public: true,
              building_id: 'building-1',
              user_building_id: 'user-building-1',
              owner_id: 'owner-1',
              location: 'RG 1',
              part_structure: {
                type: 'wall',
                length: 12.5,
                layers: [
                  { layer_index: 1, material: 'Beton', thickness: 200 },
                  { layer_index: 2, material: 'Dämmung', thickness: 120 }
                ]
              }
            }
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(EntityInfoDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a structure summary instead of raw json for parts', () => {
    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(nativeElement.querySelector('.part-structure-summary')).not.toBeNull();
    expect(nativeElement.querySelector('.structure-visual')).toBeNull();
    expect(nativeElement.textContent).toContain('Wandaufbau');
    expect(nativeElement.textContent).toContain('Schicht 1');
    expect(nativeElement.textContent).toContain('Beton');
    expect(nativeElement.textContent).toContain('12,5 m');
  });

  it('uses tooltip text and mutes fixed-zero thickness materials', () => {
    expect(component.getPartStructureOrientationHint(component.partStructure!)).toContain('innen');
    expect(component.getRenderedLayerThicknessLabel({ layer_index: 3, material: ConnectionType.conn_1, thickness: 15 })).toBe('0 mm');
    expect(component.isLayerThicknessMuted({ layer_index: 3, material: ConnectionType.conn_1, thickness: 15 })).toBeTrue();
  });

  it('renders sorted object images and switches the active image', () => {
    component.entity = {
      id: 'object-1',
      name: 'Waschbecken',
      object_type: 'sanitary',
      count: 2,
      images: [
        {
          id: 'image-1',
          sort_order: 1,
          image_url: 'https://example.com/object-image.jpg'
        },
        {
          id: 'image-2',
          sort_order: 0,
          image_url: 'https://example.com/object-image-front.jpg'
        }
      ]
    };
    component.objectImages = (component as any).resolveObjectImages();
    component.activeObjectImageIndex = 0;
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const activeImage = nativeElement.querySelector('.object-image-active') as HTMLImageElement | null;
    expect(activeImage?.getAttribute('src')).toBe('https://example.com/object-image-front.jpg');
    expect(nativeElement.querySelectorAll('.object-image-nav').length).toBe(2);
    expect(nativeElement.textContent).toContain('1 / 2');

    component.showNextObjectImage();
    fixture.detectChanges();

    const nextActiveImage = nativeElement.querySelector('.object-image-active') as HTMLImageElement | null;
    expect(nextActiveImage?.getAttribute('src')).toBe('https://example.com/object-image.jpg');
    expect(nativeElement.textContent).toContain('2 / 2');
  });
});
