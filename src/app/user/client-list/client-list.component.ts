import { Component, OnInit, ViewChild, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { ClientService } from '../../services/client.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { ProjectDetailsComponent } from '../project-details/project-details.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableDataSource } from '@angular/material/table';
import { DialogModule } from 'primeng/dialog';
import { BreadcrumbComponent } from '../../breadcrumb/breadcrumb.component';

interface PaginatedResponse {
  data: any[];
  total: number;
}

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule,
    SidebarComponent,
    MatTableModule,
    MatPaginatorModule,
    MatChipsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatCardModule,
    MatProgressSpinnerModule,
    DialogModule,
    BreadcrumbComponent
  ],
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.css'],
  providers: [DialogService]
})
export class ClientListComponent implements OnInit, AfterViewInit {
  dataSource: MatTableDataSource<any>;
  totalItems = 0;
  loading: boolean = true;
  ref: DynamicDialogRef | undefined;
  displayedColumns: string[] = ['client', 'contact', 'address', 'projects', 'actions'];
  @ViewChild(MatPaginator) paginator!: MatPaginator;
  pageSize = 5;
  pageIndex = 0;
  displayProjectDetails: boolean = false;
  selectedClient: any = null;
  selectedProjectIndex: number = 0;
  isCollapsed = false;

  constructor(
    private clientService: ClientService,
    private dialogService: DialogService,
    private cdr: ChangeDetectorRef
  ) {
    this.dataSource = new MatTableDataSource<any>([]);
  }

  async ngOnInit(): Promise<void> {
    // Initialize theme state
    this.initializeTheme();
    await this.loadProjects();
  }

  ngAfterViewInit() {
    if (this.paginator) {
      // Subscribe to paginator events
      this.paginator.page.subscribe((event: PageEvent) => {
        this.pageSize = event.pageSize;
        this.pageIndex = event.pageIndex;
        this.loadProjects();
      });
    }
  }

  // Add method to initialize theme
  private initializeTheme() {
    const savedTheme = localStorage.getItem('theme');
    const currentTheme = savedTheme || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
  }

  // Add method to handle theme changes from sidebar
  onSidebarThemeChange(theme: string) {
    // Update the document attribute to trigger CSS variable changes
    document.documentElement.setAttribute('data-theme', theme);
    this.cdr.detectChanges();
  }

  async loadProjects(): Promise<void> {
    this.loading = true;
    try {
      const offset = this.pageIndex * this.pageSize;
      const response = await this.clientService.getProjectsGroupedByClient(offset, this.pageSize);
      this.dataSource.data = response.data;
      this.totalItems = response.total;
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      this.loading = false;
    }
  }

  getProjectCountColor(count: number): string {
    if (count === 0) return 'danger';
    if (count < 3) return 'warning';
    if (count < 5) return 'info';
    return 'success';
  }

  getProjectCountClass(count: number): string {
    if (count === 0) return 'projects-badge-danger';
    if (count < 3) return 'projects-badge-warning';
    if (count < 5) return 'projects-badge-info';
    return 'projects-badge-success';
  }

  getTotalProjects(): number {
    return this.dataSource.data.reduce((total, client) => total + (client.projects?.length || 0), 0);
  }

  getTotalProjectValue(): number {
    if (!this.selectedClient?.projects?.length) return 0;
    return this.selectedClient.projects.reduce((total: number, project: any) => total + (project.total || 0), 0);
  }

  getAverageProjectValue(): number {
    if (!this.selectedClient?.projects?.length) return 0;
    const totalValue = this.getTotalProjectValue();
    return totalValue / this.selectedClient.projects.length;
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.pageIndex = event.pageIndex;
    this.loadProjects();
  }

  showClientDetails(client: any): void {
    this.selectedClient = client;
    this.selectedProjectIndex = 0;
    this.displayProjectDetails = true;
  }

  selectProject(index: number): void {
    this.selectedProjectIndex = index;
  }

  getSelectedProject(): any {
    if (!this.selectedClient?.projects?.length) return {};
    return this.selectedClient.projects[this.selectedProjectIndex] || this.selectedClient.projects[0];
  }

  closeProjectDetails(): void {
    this.displayProjectDetails = false;
    this.selectedClient = null;
    this.selectedProjectIndex = 0;
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
  }

  // Add method to handle sidebar collapse
  onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }
}
