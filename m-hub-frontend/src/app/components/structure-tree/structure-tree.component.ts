import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { Building } from '../../models/building';
import { BuildingService } from '../../services/building/building.service';
import { BuildingComponent } from '../../models/building-component';
import { BuildingComponentCategory } from '../../enums/component-category';
import { BuildingObjectService } from '../../services/building-object/building-object.service';
import { BuildingPartService } from '../../services/building-part/building-part.service';

interface TreeNode {
  id: string;
  name: string;
  type: 'building' | 'component';
  children?: TreeNode[];
}

@Component({
  selector: 'app-structure-tree',
  standalone: true,
  imports: [CommonModule, MatTreeModule, MatIconModule, MatButtonModule],
  templateUrl: './structure-tree.component.html',
  styleUrls: ['./structure-tree.component.scss']
})
export class StructureTreeComponent implements OnInit {
  @Input() entity!: Building | BuildingComponent | null;
  @Output() nodeClicked = new EventEmitter<TreeNode>();

  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  isLoading = false;
  errorMessage = '';

  constructor(
    private partService: BuildingPartService,
    private objectService: BuildingObjectService
  ) {}

  ngOnInit() {
    if (!this.entity) return;

    const buildingId = this.isBuilding(this.entity)
      ? this.entity.bw_geb_id
      : this.entity.buildingId;
  
    forkJoin({
      parts: this.partService.getComponents(buildingId),
      objects: this.objectService.getComponents(buildingId)
    }).subscribe({
      next: ({ parts, objects }) => {
        const components = [...parts, ...objects];

        const root: TreeNode = {
          id: buildingId.toString(),
          name: `Gebäude ${buildingId}`,
          type: 'building',
          children: components.map(c => ({
            id: c.id,
            name: c.name,
            type: 'component',
            category: c.category as BuildingComponentCategory
          }))
        };

        this.dataSource.data = [root];
        this.treeControl.dataNodes = this.dataSource.data;
        this.treeControl.expandAll();
      },
      error: (err) => {
        console.error('Failed to load building components:', err);
        this.errorMessage = 'Failed to load building components';
      },
      complete: () => this.isLoading = false
    });
  }

  private isBuilding(entity: Building | BuildingComponent): entity is Building {
    return (entity as Building).bw_geb_id !== undefined;
  }

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  toggleNode(node: TreeNode) {
    this.treeControl.isExpanded(node)
      ? this.treeControl.collapse(node)
      : this.treeControl.expand(node);
  }

  onNodeClick(node: TreeNode): void {
    console.log("clicked on node", node.name);
    this.nodeClicked.emit(node);
  }
}
