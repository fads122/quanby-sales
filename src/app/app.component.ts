import { Component } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
import { NgIf } from '@angular/common';
import { SupabaseService } from './services/supabase.service';
import { filter } from 'rxjs/operators';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BreadcrumbComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'quanby-sales';
  isLoginPage = false;

  constructor(public router: Router) {
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.isLoginPage = event.urlAfterRedirects.includes('/login');
    });
  }


  // Show breadcrumb unless on `/login`
  get showBreadcrumb(): boolean {
    return this.router.url !== '/login';
  }
}
