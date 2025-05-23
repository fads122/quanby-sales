import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SupabaseAuthService } from '../services/supabase-auth.service';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: SupabaseAuthService, private router: Router) {}

  async canActivate(): Promise<boolean> {
    const isLoggedIn = await this.authService.isLoggedIn();
    if (!isLoggedIn) {
      console.warn('⚠️ Unauthorized access. Redirecting to Page Not Found.');
      this.router.navigate(['/page-not-found']);
      return false;
    }
    return true;
  }
}
