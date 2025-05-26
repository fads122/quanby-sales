import { Component, OnInit, ViewChild } from '@angular/core';
import { ClientService } from '../../services/client.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { ProjectDetailsComponent } from '../project-details/project-details.component';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator } from '@angular/material/paginator';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatCardModule } from '@angular/material/card';
import { MatChip } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

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
    // MatChip
  ],
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.css'],
  providers: [DialogService]
})
export class ClientListComponent implements OnInit {
  clientGroups: any[] = [];
  loading: boolean = true;
  ref: DynamicDialogRef | undefined;
  displayedColumns: string[] = ['client', 'contact', 'address', 'projects', 'actions'];
  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(
    private clientService: ClientService,
    private dialogService: DialogService
  ) {}

  async ngOnInit(): Promise<void> {
    await this.loadProjects();
  }

  async loadProjects(): Promise<void> {
    this.loading = true;
    try {
      this.clientGroups = await this.clientService.getProjectsGroupedByClient();
    } catch (error) {
      console.error('Error loading projects:', error);
    } finally {
      this.loading = false;
    }
  }

  getProjectCountColor(count: number): string {
    if (count === 0) return 'warn';
    if (count < 3) return 'accent';
    return 'primary';
  }

  showClientDetails(clientGroup: any): void {
    const modalData = {
      client: {
        ...clientGroup,
        projects: clientGroup.projects || []
      }
    };

    this.ref = this.dialogService.open(ProjectDetailsComponent, {
      header: `Client Details`,
      width: 'min(90vw, 900px)',
      contentStyle: {
        'max-height': '80vh',
        'overflow': 'auto',
        'border-radius': '8px'
      },
      styleClass: 'client-details-modal',
      baseZIndex: 10000,
      data: modalData
    });
  }

  ngOnDestroy(): void {
    if (this.ref) {
      this.ref.close();
    }
  }
}
