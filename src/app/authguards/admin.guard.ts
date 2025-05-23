import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { SupabaseAuthService } from '../services/supabase-auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminGuard implements CanActivate {
  constructor(
    private authService: SupabaseAuthService,
    private router: Router
  ) {}

  async canActivate(): Promise<boolean> {
    const user = await this.authService.getUser();
    if (!user) {
      console.warn('⚠️ No user logged in, redirecting to Page Not Found.');
      this.router.navigate(['/page-not-found']);
      return false;
    }

    const profile = await this.authService.getUserProfile(user.id);

    console.log('🔍 Checking user access:', profile);

    if (profile && profile.usertype === 'admin') {
      console.log('✅ Admin access granted.');
      return true;
    } else {
      console.warn('⛔ Unauthorized access, redirecting to Page Not Found.');
      this.router.navigate(['/page-not-found']);
      return false;
    }
  }
}
