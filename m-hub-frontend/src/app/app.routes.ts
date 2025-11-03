import { Routes } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { UserDataComponent } from './components/user-data/user-data.component';
import { HubComponent } from './components/hub/hub.component';
import { NotFoundComponent } from './components/not-found/not-found.component';

export const routes: Routes = [
    { path: 'map', component: MapComponent },
    { path: 'hub', component: HubComponent },
    { path: 'data', component: UserDataComponent },
    { path: '', redirectTo: 'map', pathMatch: 'full' },   // default route
    { path: '**', component: NotFoundComponent }          // wildcard route
  ];
