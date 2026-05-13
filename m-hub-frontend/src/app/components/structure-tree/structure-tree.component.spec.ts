import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

import { StructureTreeComponent } from './structure-tree.component';

describe('StructureTreeComponent', () => {
  let component: StructureTreeComponent;
  let fixture: ComponentFixture<StructureTreeComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoopAnimationsModule, StructureTreeComponent],
      providers: [provideHttpClient()]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StructureTreeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('marks the selected node as active', () => {
    component.selectedNodeId = 'component-1';
    component.dataSource.data = [
      {
        id: 'building-1',
        name: 'Gebäude building-1',
        nodeType: 'building',
        children: [
          {
            id: 'component-1',
            name: 'Fenster',
            nodeType: 'component',
            canRead: true
          } as any
        ]
      } as any
    ];
    component.treeControl.dataNodes = component.dataSource.data;
    component.treeControl.expandAll();
    fixture.detectChanges();

    const activeNode = fixture.nativeElement.querySelector('mat-tree-node.active');
    expect(activeNode?.textContent).toContain('Fenster');
  });
});
