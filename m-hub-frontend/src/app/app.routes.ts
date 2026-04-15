import { Routes } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { UserDataComponent } from './components/user-data/user-data.component';
import { MarketComponent } from './components/market/market.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { authenticationGuard } from './services/authentication/authentication.guard';
import { ImprintComponent } from './components/imprint/imprint.component';

export const routes: Routes = [
    { path: 'map', component: MapComponent },
    { path: 'market', component: MarketComponent },
    { path: 'data', component: UserDataComponent, canActivate: [authenticationGuard] },
    { path: 'imprint', component: ImprintComponent },
    { path: '', redirectTo: 'map', pathMatch: 'full' },   // default route
    { path: '**', component: NotFoundComponent }          // wildcard route
  ];
