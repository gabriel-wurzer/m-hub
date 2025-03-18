import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { MatIconModule } from '@angular/material/icon';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import {MatDividerModule} from '@angular/material/divider';

@Component({
  selector: 'app-menu-bar',
  standalone: true,
  imports: [ RouterOutlet, CommonModule, MatToolbarModule,MatSidenavModule, MatListModule, MatIconModule, MatButtonModule, MatDividerModule],
  templateUrl: './menu-bar.component.html',
  styleUrl: './menu-bar.component.scss'
})
export class MenuBarComponent implements OnInit {

  currentRoute: string = '/map';

  isMobile = false;

  constructor(private router: Router, private breakpointObserver: BreakpointObserver) {
    this.router.events.subscribe((event) => {
      if (event instanceof NavigationEnd) {
        // Example: '/map', '/hub', '/data'
        this.currentRoute = event.urlAfterRedirects;
      }
    });
  }

  ngOnInit() {
    this.breakpointObserver.observe(['(max-width: 1199px)']).subscribe(result => {
      this.isMobile = result.matches;
    });
  }

  // onMenuClick(menuName: string) {
  //   switch (menuName) {
  //     case 'map':
  //       this.router.navigate(['/map']);
  //       break;
  //     case 'hub':
  //       this.router.navigate(['/hub']);
  //       break;
  //     case 'data':
  //       this.router.navigate(['/data']);
  //       break;
  //     default:
  //       console.warn('Unknown route:', menuName);
  //       break;
  //   }
  // }

  onMenuClick(route: string): void {
    this.router.navigate([`/${route}`]);
  }

  onProfileClick() {
    console.log('Profile clicked');
  }
}
