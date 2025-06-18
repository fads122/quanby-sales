import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { BreadcrumbService } from '../services/breadcrumb.service';
import { MatMenuModule } from '@angular/material/menu';
import { AsyncPipe } from '@angular/common';

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    RouterModule,
    MatButtonModule,
    MatMenuModule,
    AsyncPipe
  ],
  templateUrl: './breadcrumb.component.html',
  styleUrls: ['./breadcrumb.component.css']
})
export class BreadcrumbComponent implements OnInit, OnChanges {
  isCollapsed = false;

  constructor(
    public breadcrumbService: BreadcrumbService
  ) {}

  ngOnInit() {
    // Initialize theme state
    this.initializeTheme();
    // Breadcrumb service subscription for debugging removed
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sidebarCollapsed']) {
      this.isCollapsed = changes['sidebarCollapsed'].currentValue;
      console.log('Breadcrumb: Sidebar collapsed state changed to:', this.isCollapsed);
    }
  }

  @Input() set sidebarCollapsed(value: boolean) {
    this.isCollapsed = value;
  }

  // Add method to initialize theme
  private initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const currentTheme = savedTheme || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
  }
}
