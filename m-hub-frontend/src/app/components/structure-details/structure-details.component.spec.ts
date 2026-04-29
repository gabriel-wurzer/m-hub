import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StructureDetailsComponent } from './structure-details.component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { PartType } from '../../enums/part-type.enum';
import { MaterialType } from '../../enums/material-type.enum';
import { FloorType } from '../../enums/floor-type.enum';

describe('StructureDetailsComponent', () => {
  let component: StructureDetailsComponent;
  let fixture: ComponentFixture<StructureDetailsComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StructureDetailsComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StructureDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('renders a structure summary for bauteile', () => {
    component.structure = [
      {
        type: FloorType.RG,
        count: 1,
        height: 280,
        area: 100,
        description: 'Wohngeschoss'
      }
    ];

    component.entity = {
      id: 'part-1',
      building_id: 'building-1',
      user_building_id: 'user-building-1',
      owner_id: 'owner-1',
      category: BuildingComponentCategory.Bauteil,
      name: 'Innenwand West',
      description: 'Testbauteil',
      is_public: true,
      is_hazardous: false,
      part_type: PartType.IW,
      location: 'RG 1',
      part_structure: {
        type: 'wall',
        length: 12.5,
        layers: [
          { layer_index: 1, material: MaterialType.mat_1, thickness: 120 },
          { layer_index: 2, material: MaterialType.mat_6, thickness: 15 }
        ]
      }
    } as any;

    component.ngOnChanges({
      structure: {
        currentValue: component.structure,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      },
      entity: {
        currentValue: component.entity,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.querySelector('.part-structure-summary')).not.toBeNull();
    expect(nativeElement.textContent).toContain('Schadstoffe: nicht enthalten');
    expect(nativeElement.textContent).toContain('Verortung:');
    expect(nativeElement.textContent).toContain('RG 1');
    expect(nativeElement.textContent).toContain('(Wohngeschoss)');
    expect(nativeElement.textContent).toContain('Bauteil-Kategorie: Innenwand');
    expect(nativeElement.textContent).toContain('Anzahl Schichten: 2');
    expect(nativeElement.textContent).toContain('Gesamtstärke: 135 mm');
    expect(nativeElement.textContent).toContain('Schicht 1');
    expect(nativeElement.textContent).toContain('Ziegel');
  });

  it('renders count, location and image for objekte', () => {
    component.structure = [
      {
        type: FloorType.RG,
        count: 1,
        height: 280,
        area: 100,
        description: 'Wohngeschoss'
      }
    ];

    component.entity = {
      id: 'object-1',
      building_id: 'building-1',
      user_building_id: 'user-building-1',
      owner_id: 'owner-1',
      category: BuildingComponentCategory.Objekt,
      name: 'Waschbecken',
      description: 'Testobjekt',
      is_public: true,
      is_hazardous: false,
      count: 3,
      location: 'RG 1',
      images: [
        {
          id: 'image-1',
          building_object_id: 'object-1',
          sort_order: 0,
          image_path: '/mhub/objects/object-1/image.jpg',
          image_url: 'https://example.com/object-image.jpg'
        }
      ]
    } as any;

    component.ngOnChanges({
      structure: {
        currentValue: component.structure,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      },
      entity: {
        currentValue: component.entity,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.textContent).toContain('Schadstoffe: nicht enthalten');
    expect(nativeElement.textContent).toContain('Verortung:');
    expect(nativeElement.textContent).toContain('RG 1');
    expect(nativeElement.textContent).toContain('(Wohngeschoss)');
    expect(nativeElement.textContent).toContain('Anzahl: 3');

    const image = nativeElement.querySelector('.object-image') as HTMLImageElement | null;
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://example.com/object-image.jpg');
  });

  it('renders a dash when bauteil and objekt descriptions are empty', () => {
    component.entity = {
      id: 'part-2',
      building_id: 'building-1',
      user_building_id: 'user-building-1',
      owner_id: 'owner-1',
      category: BuildingComponentCategory.Bauteil,
      name: 'Leeres Bauteil',
      description: '',
      is_public: true,
      is_hazardous: false,
      part_type: PartType.IW,
      location: 'RG 1',
      part_structure: {
        type: 'wall',
        length: 1,
        layers: []
      }
    } as any;

    component.ngOnChanges({
      entity: {
        currentValue: component.entity,
        previousValue: null,
        firstChange: true,
        isFirstChange: () => true
      }
    });
    fixture.detectChanges();

    let nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.textContent).toContain('Beschreibung: —');

    component.entity = {
      id: 'object-2',
      building_id: 'building-1',
      user_building_id: 'user-building-1',
      owner_id: 'owner-1',
      category: BuildingComponentCategory.Objekt,
      name: 'Leeres Objekt',
      description: '   ',
      is_public: true,
      is_hazardous: false,
      count: 1,
      location: 'RG 1'
    } as any;

    component.ngOnChanges({
      entity: {
        currentValue: component.entity,
        previousValue: null,
        firstChange: false,
        isFirstChange: () => false
      }
    });
    fixture.detectChanges();

    nativeElement = fixture.nativeElement as HTMLElement;
    expect(nativeElement.textContent).toContain('Beschreibung: —');
  });
});
