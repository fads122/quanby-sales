import { Component, OnInit } from '@angular/core';
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
export class AppComponent implements OnInit {
  title = 'quanby-sales';

  constructor(
    public router: Router,
    private supabase: SupabaseService
  ) {}

  async ngOnInit() {
    // Load TensorFlow model when app starts
    try {
      await this.supabase.loadModel();
      console.log('TensorFlow model loaded successfully');
    } catch (error) {
      console.error('Failed to load TensorFlow model:', error);
      // You might want to add user notification here
    }
  }

  // Show breadcrumb unless on `/login`
  get showBreadcrumb(): boolean {
    return this.router.url !== '/login';
  }
}
