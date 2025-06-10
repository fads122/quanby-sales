import { Component, Input } from '@angular/core';
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
export class BreadcrumbComponent {
  isCollapsed = false;

  constructor(
    public breadcrumbService: BreadcrumbService
  ) {}

  @Input() set sidebarCollapsed(value: boolean) {
    this.isCollapsed = value;
  }
}
