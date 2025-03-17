import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { NgIf } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-sidebar-menu',
  standalone: true,
  imports: [MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, NgIf],
  templateUrl: './sidebar-menu.component.html',
  styleUrl: './sidebar-menu.component.scss'
})
export class SidebarMenuComponent {

  constructor(private router: Router) {}

  onMenuClick(menuName: string) {
    switch (menuName) {
      case 'map':
        this.router.navigate(['/map']);
        break;
      case 'hub':
        this.router.navigate(['/hub']);
        break;
      case 'data':
        this.router.navigate(['/data']);
        break;
      default:
        console.warn('Unknown route:', menuName);
        break;
    }
  }

  onProfileClick() {
    console.log('Profile clicked');
    // Show profile modal or navigate to profile
  }
}
