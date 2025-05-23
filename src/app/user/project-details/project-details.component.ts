import { Component } from '@angular/core';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DividerModule } from 'primeng/divider';
import { ClientService } from '../../services/client.service';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

@Component({
  selector: 'app-project-details',
  standalone: true,
  imports: [CommonModule, ButtonModule, TagModule, DividerModule, ProgressSpinnerModule],
  templateUrl: './project-details.component.html',
  styleUrls: ['./project-details.component.css']
})
export class ProjectDetailsComponent {
  client: any;
  selectedProject: any;
  deliveryStatus: string = 'Pending Delivery'; // Default status
    deliveryReceipts: any[] = [];
  isLoading: boolean = true;

  constructor(
    public ref: DynamicDialogRef,
    public config: DynamicDialogConfig,
    private clientService: ClientService
  ) {
    this.client = this.config.data?.client || {};
    this.selectedProject = this.client.projects?.[0] || {};
    this.loadDeliveryStatus();
  }

  async loadDeliveryStatus() {
  this.isLoading = true;
  try {
    this.deliveryReceipts = await this.clientService.getDeliveryReceipts(this.selectedProject.id);

    if (this.deliveryReceipts?.length) {
      const latestReceipt = this.deliveryReceipts.reduce((latest, receipt) =>
        new Date(receipt.created_at) > new Date(latest.created_at) ? receipt : latest
      );

      this.deliveryStatus = latestReceipt.status || 'Pending Delivery';

      // 👇 Inject the latest status into the selectedProject object
      this.selectedProject.delivery_status = this.deliveryStatus;

    } else {
      this.deliveryStatus = 'Pending Delivery';
      this.selectedProject.delivery_status = this.deliveryStatus;
    }

  } catch (error) {
    console.error('Error loading delivery status:', error);
    this.deliveryStatus = 'Status Unknown';
    this.selectedProject.delivery_status = this.deliveryStatus;
  } finally {
    this.isLoading = false;
  }
}


  selectProject(project: any): void {
    this.selectedProject = project || {};
    this.loadDeliveryStatus(); // Reload status when project changes
  }

  // Simplified status methods
  getStatusSeverity(status: string | undefined): string {
    if (!status) return 'primary';

    switch(status.toLowerCase()) {
      case 'delivered': return 'success';
      case 'delivering': return 'info';
      case 'pending': return 'warning';
      case 'cancelled': return 'danger';
      default: return 'primary';
    }
  }

  getDeliveryStatusText(status: string | undefined): string {
    if (!status) return 'Pending Delivery';

    switch(status.toLowerCase()) {
      case 'delivered': return 'Delivered';
      case 'delivering': return 'In Progress';
      case 'pending': return 'Pending Delivery';
      case 'cancelled': return 'Cancelled';
      default: return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
    }
  }

getDisplayStatus(status: string | undefined): string {
  if (!status) return 'Status Unknown';

  const statusMap: {[key: string]: string} = {
    'delivered': 'Delivered',
    'completed': 'Completed',
    'in progress': 'In Progress',
    'delivering': 'Delivering',
    'pending': 'Pending',
    'not yet delivered': 'Not Yet Delivered',
    'cancelled': 'Cancelled',
    'rejected': 'Rejected'
  };

  return statusMap[status.toLowerCase()] || status;
}

  downloadFile(url: string | undefined) {
    if (url) {
      window.open(url, '_blank');
    }
  }
}
