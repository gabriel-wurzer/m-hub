import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'plans',
    loadComponent: () =>
      import('./components/plan-list/plan-list.component').then((m) => m.PlanListComponent),
  },
  {
    path: 'plan/:id',
    loadComponent: () =>
      import('./components/plan-editor/plan-editor.component').then((m) => m.PlanEditorComponent),
  },
  { path: '', redirectTo: 'plans', pathMatch: 'full' },
  { path: '**', redirectTo: 'plans' },
];
