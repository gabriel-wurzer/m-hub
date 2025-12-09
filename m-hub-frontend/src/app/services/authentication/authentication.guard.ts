import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthenticationService } from './authentication.service';

export const authenticationGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthenticationService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  } else {
    // Redirect to map if trying to access protected route while logged out
    router.navigate(['/map']);
    return false;
  }
};