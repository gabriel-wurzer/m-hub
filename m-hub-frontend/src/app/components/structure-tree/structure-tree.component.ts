import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';

import { Building } from '../../models/building';
import { BuildingPart } from '../../models/building-part';
import { BuildingService } from '../../services/building/building.service';

interface TreeNode {
  id: string;
  name: string;
  type: 'building' | 'building_part';
  buildingParts?: TreeNode[];
}

@Component({
  selector: 'app-structure-tree',
  standalone: true,
  imports: [CommonModule, MatTreeModule, MatIconModule, MatButtonModule],
  templateUrl: './structure-tree.component.html',
  styleUrls: ['./structure-tree.component.scss']
})
export class StructureTreeComponent implements OnInit {
  @Input() entity!: Building | BuildingPart | null;

  treeControl = new NestedTreeControl<TreeNode>(node => node.buildingParts);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  constructor(private buildingService: BuildingService) { }

  ngOnInit() {
    if (!this.entity) return;

    let buildingId: number;
  
    if (this.isBuilding(this.entity)) {
      buildingId = this.entity.bw_geb_id;
    } else {
      buildingId = parseInt(this.entity.buildingId);
    }
    
    this.buildingService.getBuildingPartsByBuilding(buildingId).subscribe({
      next: (parts) => {
        const root: TreeNode = {
          id: buildingId.toString(),
          name: `Gebäude ${buildingId}`,
          type: 'building',
          buildingParts: this.buildChildren(parts)
        };
        this.dataSource.data = [root];

        this.treeControl.dataNodes = this.dataSource.data;
        this.treeControl.expandAll();
      },
      error: (err) => console.error('Failed to load building parts:', err)
    });
  }

  private isBuilding(entity: Building | BuildingPart): entity is Building {
    return (entity as Building).bw_geb_id !== undefined;
  }

  buildChildren(parts: BuildingPart[]): TreeNode[] {
    return parts.map(part => ({
      id: part.id,
      name: part.name,
      type: 'building_part',
      buildingParts: this.buildChildren(part.buildingParts ?? [])
    }));
  }

  findSubtree(targetId: string, parts: BuildingPart[]): TreeNode[] {
    for (const part of parts) {
      if (part.id === targetId) {
        return this.buildChildren(part.buildingParts ?? []);
      }
      if (part.buildingParts?.length) {
        const sub = this.findSubtree(targetId, part.buildingParts);
        if (sub.length > 0) return sub;
      }
    }
    return [];
  }

  hasChild = (_: number, node: TreeNode) => !!node.buildingParts && node.buildingParts.length > 0;

  toggleNode(node: TreeNode) {
    this.treeControl.isExpanded(node)
      ? this.treeControl.collapse(node)
      : this.treeControl.expand(node);
  }
}
