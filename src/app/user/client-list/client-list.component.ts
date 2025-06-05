import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
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
    DialogModule
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

  constructor(
    private clientService: ClientService,
    private dialogService: DialogService
  ) {
    this.dataSource = new MatTableDataSource<any>([]);
  }

  async ngOnInit(): Promise<void> {
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

  showClientDetails(client: any): void {
    this.selectedClient = client;
    this.displayProjectDetails = true;
  }

  closeProjectDetails(): void {
    this.displayProjectDetails = false;
    this.selectedClient = null;
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
  }
}
