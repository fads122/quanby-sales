import { Component, OnInit } from '@angular/core';
import { ClientService } from '../../services/client.service';
import { DialogService, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { CardModule } from 'primeng/card';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { ProjectDetailsComponent } from '../project-details/project-details.component';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { TooltipModule } from 'primeng/tooltip';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; // Add this
import { MatFormFieldModule } from '@angular/material/form-field'; // Add this
import { MatInputModule } from '@angular/material/input'; // Add this
import { MatIconModule } from '@angular/material/icon'; // Add this
import { MatDividerModule } from '@angular/material/divider'; // Add this
import { MatButtonModule } from '@angular/material/button'; // Add this
import { FormBuilder, FormGroup, Validators } from '@angular/forms'; // Add this

@Component({
  selector: 'app-client-list',
  standalone: true,
  imports: [
    CommonModule,
    TableModule,
    CardModule,
    SidebarComponent,
    ButtonModule,
    TagModule,
    TooltipModule
  ],
  templateUrl: './client-list.component.html',
  styleUrls: ['./client-list.component.css'],
  providers: [DialogService]
})
export class ClientListComponent implements OnInit {
  clientGroups: any[] = [];
  loading: boolean = true;
  ref: DynamicDialogRef | undefined;
  first: number = 0;
  rows: number = 10;

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

  next() {
    this.first = this.first + this.rows;
  }

  prev() {
    this.first = this.first - this.rows;
  }

  isLastPage(): boolean {
    return this.clientGroups ? this.first + this.rows >= this.clientGroups.length : true;
  }

  isFirstPage(): boolean {
    return this.clientGroups ? this.first === 0 : true;
  }

  pageChange(event: any) {
    this.first = event.first;
    this.rows = event.rows;
  }

  getProjectCountSeverity(count: number): string {
    if (count === 0) return 'danger';
    if (count < 3) return 'warning';
    if (count < 6) return 'info';
    return 'success';
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
