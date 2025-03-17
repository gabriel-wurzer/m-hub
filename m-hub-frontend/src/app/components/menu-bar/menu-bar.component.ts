import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [ RouterOutlet, CommonModule, MatToolbarModule,MatSidenavModule, MatListModule, MatIconModule, MatButtonModule],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss'
})
export class MenuBarComponent implements OnInit {

  isMobile = false;

  constructor(private router: Router, private breakpointObserver: BreakpointObserver) {}

  ngOnInit() {
    this.breakpointObserver.observe(['(max-width: 1199px)']).subscribe(result => {
      this.isMobile = result.matches;
    });
  }

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
  }
}
