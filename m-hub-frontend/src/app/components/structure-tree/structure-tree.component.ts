import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { forkJoin } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponentCategory } from '../../enums/component-category';
import { BuildingObjectService } from '../../services/building-object/building-object.service';
import { BuildingPartService } from '../../services/building-part/building-part.service';
import { MatTooltipModule } from '@angular/material/tooltip';

interface TreeNode {
  id: string;
  name: string;
  nodeType: 'building' | 'component';
  category?: BuildingComponentCategory;
  ownerId?: string;
  isPublic?: boolean;
  children?: TreeNode[];
}

@Component({
  selector: 'app-structure-tree',
  standalone: true,
  imports: [CommonModule, MatTreeModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './structure-tree.component.html',
  styleUrls: ['./structure-tree.component.scss']
})
export class StructureTreeComponent implements OnInit {
  @Input() entity!: Building;
  @Output() nodeClicked = new EventEmitter<TreeNode>();
  @Output() loadingChange = new EventEmitter<boolean>();

  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  errorMessage = '';
  isLoading = false;

  userId = "c3e5b0fc-cc48-4a6f-8e27-135b6d3a1b71";

  constructor(
    private partService: BuildingPartService,
    private objectService: BuildingObjectService
  ) {}

  ngOnInit() {
    if (!this.entity) return;

    this.setLoading(true);
    const buildingId = this.entity.bw_geb_id; 

    forkJoin({
      parts: this.partService.getComponents(buildingId),
      objects: this.objectService.getComponents(buildingId)
    }).subscribe({
      next: ({ parts, objects }) => {
        const components = [...parts, ...objects];

        const root: TreeNode = {
          id: buildingId.toString(),
          name: `Gebäude ${buildingId}`,
          nodeType: 'building',
          children: components.map(c => ({
            id: c.id,
            name: c.name,
            nodeType: 'component',
            category: c.category as BuildingComponentCategory,
            ownerId: c.ownerId,
            isPublic: c.isPublic
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
      complete: () => this.setLoading(false)
    });
  }

  isBuildingNode = (_: number, node: TreeNode) => node.nodeType === 'building';

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  toggleNode(node: TreeNode) {
    this.treeControl.isExpanded(node)
      ? this.treeControl.collapse(node)
      : this.treeControl.expand(node);
  }

  onNodeClickAllowed(node: TreeNode): void {
    // Only enforce access restrictions for components
    if (node.nodeType === 'component') {
      const hasAccess = node.isPublic || node.ownerId === this.userId;
      if (!hasAccess) {
        console.warn(`Access denied to node: ${node.name}`);
        return;
      }
    }

    console.log("clicked on node", node.name);
    this.nodeClicked.emit(node);
  }

  private setLoading(value: boolean) {
    this.isLoading = value;
    this.loadingChange.emit(value);
  }
}
