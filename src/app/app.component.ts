import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { BreadcrumbComponent } from './breadcrumb/breadcrumb.component';
import { NgIf } from '@angular/common';
import { SupabaseService } from './services/supabase.service';


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, BreadcrumbComponent, NgIf],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'quanby-sales';

  constructor(public router: Router) {}


  // Show breadcrumb unless on `/login`
  get showBreadcrumb(): boolean {
    return this.router.url !== '/login';
  }
}
