import { Component } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { NgIf } from '@angular/common'; // ✅ Import NgIf


@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet], // ✅ Add NgIf here
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
