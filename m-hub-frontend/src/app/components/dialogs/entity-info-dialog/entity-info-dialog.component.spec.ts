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
});
