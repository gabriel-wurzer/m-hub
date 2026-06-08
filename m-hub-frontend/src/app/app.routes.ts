import { Routes } from '@angular/router';
import { MapComponent } from './components/map/map.component';
import { UserDataComponent } from './components/user-data/user-data.component';
import { MarketComponent } from './components/market/market.component';
import { NotFoundComponent } from './components/not-found/not-found.component';
import { authenticationGuard } from './services/authentication/authentication.guard';
import { ImprintComponent } from './components/imprint/imprint.component';
import { PrivacyComponent } from './components/privacy/privacy.component';

export const routes: Routes = [
    { path: 'karte', component: MapComponent },
    { path: 'markt', component: MarketComponent },
    { path: 'bestandsverwaltung', component: UserDataComponent, canActivate: [authenticationGuard] },
    { path: 'impressum', component: ImprintComponent },
    { path: 'datenschutz', component: PrivacyComponent },
    { path: '', redirectTo: 'karte', pathMatch: 'full' },   // default route
    { path: '**', component: NotFoundComponent }          // wildcard route
  ];
