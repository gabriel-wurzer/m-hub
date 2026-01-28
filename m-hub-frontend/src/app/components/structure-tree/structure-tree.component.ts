import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTreeModule } from '@angular/material/tree';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTreeNestedDataSource } from '@angular/material/tree';
import { NestedTreeControl } from '@angular/cdk/tree';
import { map, Observable, skip, Subscription } from 'rxjs';

import { Building } from '../../models/building';
import { BuildingComponentCategory } from '../../enums/component-category';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BuildingService } from '../../services/building/building.service';
import { AuthenticationService } from '../../services/authentication/authentication.service';

interface TreeNode {
  id: string;
  name: string;
  nodeType: 'building' | 'component';
  category?: BuildingComponentCategory;
  canRead?: boolean;
  children?: TreeNode[];
}

@Component({
  selector: 'app-structure-tree',
  standalone: true,
  imports: [CommonModule, MatTreeModule, MatIconModule, MatButtonModule, MatTooltipModule],
  templateUrl: './structure-tree.component.html',
  styleUrls: ['./structure-tree.component.scss']
})
export class StructureTreeComponent implements OnInit, OnDestroy {
  @Input() entity!: Building;
  @Output() nodeClicked = new EventEmitter<TreeNode>();
  @Output() loadingChange = new EventEmitter<boolean>();

  treeControl = new NestedTreeControl<TreeNode>(node => node.children);
  dataSource = new MatTreeNestedDataSource<TreeNode>();

  errorMessage = '';
  isLoading = false;

  isLoggedIn$: Observable<boolean>;
  private authSubscription: Subscription | undefined;

  constructor(
    private authService: AuthenticationService,
    private buildingService: BuildingService
  ) {
    this.isLoggedIn$ = this.authService.getUser$().pipe(
      map(user => !!user)
    );
  }

  ngOnInit() {
    if (!this.entity) return;

    this.loadComponents(this.entity.bw_geb_id);

    this.authSubscription = this.authService.getUser$()
    .pipe(skip(1))
    .subscribe(() => {
      if (this.entity?.bw_geb_id) {
        this.loadComponents(this.entity.bw_geb_id);
      }
    });
  }

  ngOnDestroy(): void {
    if (this.authSubscription) {
      this.authSubscription.unsubscribe();
    }
  }

  private loadComponents(buildingId: string): void {
    this.setLoading(true);
    this.buildingService.getAllComponentsByBuilding(buildingId).subscribe({
      next: (components) => {
        const normalizedComponents = components.map(component => {
          const canRead = (component as { canRead?: boolean; can_read?: boolean }).canRead
            ?? (component as { can_read?: boolean }).can_read
            ?? false;

          return {
            id: component.id,
            name: component.name,
            category: component.category as BuildingComponentCategory,
            canRead
          };
        });

        const sortedComponents = [...normalizedComponents].sort((a, b) =>
          (a.name || '').localeCompare(b.name || '')
        );

        const root: TreeNode = {
          id: buildingId.toString(),
          name: `Gebäude ${buildingId}`,
          nodeType: 'building',
          children: sortedComponents.map(c => ({
            id: c.id,
            name: c.name,
            nodeType: 'component',
            category: c.category,
            canRead: c.canRead
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
      if (!node.canRead) {
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
