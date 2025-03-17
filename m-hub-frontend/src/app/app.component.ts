import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
// import { MapComponent } from './components/map/map.component';
import { SidebarMenuComponent } from './components/sidebar-menu/sidebar-menu.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, SidebarMenuComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})
export class AppComponent {
  title = 'm-hub-frontend';
}
