import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';

import { Building } from '../../models/building';
import { BuildingPart } from '../../models/building-part';

interface TreeNode {
  id: string;
  name: string;
  type: 'building' | 'building_part';
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
  @Input() entity!: Building | BuildingPart | null;
  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  ngOnInit() {
    if (this.entity) {
      this.dataSource.data = [this.buildTree(this.entity)];
    }
  }

  buildTree(entity: Building | BuildingPart): TreeNode {
    const node: TreeNode = {
      id: 'bw_geb_id' in entity ? entity.bw_geb_id.toString() : entity.id,
      name: 'bw_geb_id' in entity ? `Gebäude ${entity.bw_geb_id}` : `Bauelement ${entity.id}`,
      type: 'bw_geb_id' in entity ? 'building' : 'building_part',
      children: []
    };
    
    const parts = 'buildingParts' in entity ? entity.buildingParts : ('children' in entity ? entity.children : []);
    if (parts) {
      node.children = parts
        .filter(part => part.type === 'building_part')
        .map(part => this.buildTree(part));
    }
    
    return node;
  }

  hasChild = (_: number, node: TreeNode) => !!node.children && node.children.length > 0;

  toggleNode(node: TreeNode) {
    this.treeControl.isExpanded(node)
      ? this.treeControl.collapse(node)
      : this.treeControl.expand(node);
  }
}
