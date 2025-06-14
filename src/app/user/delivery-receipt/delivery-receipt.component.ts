import { Component, OnInit, ViewChild, TemplateRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialog, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatPaginatorModule, MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSortModule, MatSort } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatChipsModule } from '@angular/material/chips';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';

interface DeliveryReceipt {
  id: string;
  project_name: string;
  client_name: string;
  delivery_date: string;
  status: 'Delivering' | 'Delivered';
  attached_file?: string;
  received_by?: string;
  delivered_date?: string;
  delivered_time?: string;
}

interface FileDialogData {
  url: string;
}

@Component({
  selector: 'app-delivery-receipt',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatCardModule,
    MatTooltipModule,
    MatMenuModule,
    MatChipsModule,
    SidebarComponent,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule
  ],
  templateUrl: './delivery-receipt.component.html',
  styleUrls: ['./delivery-receipt.component.css']
})
export class DeliveryReceiptComponent implements OnInit, AfterViewInit {
  private supabase: SupabaseClient;
  dataSource: MatTableDataSource<DeliveryReceipt>;
  loading: boolean = true;
  searchQuery: string = '';
  selectedReceipt: DeliveryReceipt | null = null;
  selectedUpdateFile: File | null = null;

  displayedColumns: string[] = ['project', 'client', 'delivery_date', 'status', 'attachment', 'actions'];
  rows: number = 5;
  pageIndex = 0;

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild('receiptDetailsDialog') receiptDetailsDialog!: TemplateRef<any>;
  @ViewChild('fileDialog') fileDialog!: TemplateRef<any>;

  constructor(
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer
  ) {
    this.supabase = createClient(
      'https://xvcgubrtandfivlqcmww.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'
    );
    this.dataSource = new MatTableDataSource<DeliveryReceipt>([]);

    // Set up custom filter predicate
    this.dataSource.filterPredicate = (data: DeliveryReceipt, filter: string) => {
      const searchStr = filter.toLowerCase();
      return data.project_name.toLowerCase().includes(searchStr) ||
             data.client_name.toLowerCase().includes(searchStr) ||
             data.delivery_date.toLowerCase().includes(searchStr) ||
             data.status.toLowerCase().includes(searchStr);
    };
  }

  async ngOnInit(): Promise<void> {
    await this.loadReceipts();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  async loadReceipts(): Promise<void> {
    this.loading = true;
    try {
      const { data, error } = await this.supabase
        .from('delivery_receipts')
        .select('*');

      if (error) throw error;

      const receipts = data.map(receipt => ({
        ...receipt,
        attached_file: receipt.attached_file ?
          `https://xvcgubrtandfivlqcmww.supabase.co/storage/v1/object/public/delivery_receipts/${receipt.attached_file}` :
          undefined
      }));

      this.dataSource.data = receipts;
    } catch (error) {
      console.error('Error loading receipts:', error);
      this.snackBar.open('Failed to load delivery receipts', 'Close', { duration: 3000 });
    } finally {
      this.loading = false;
    }
  }

  filterReceipts(): void {
    this.dataSource.filter = this.searchQuery.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  pageChange(event: PageEvent): void {
    this.rows = event.pageSize;
    this.pageIndex = event.pageIndex;
  }

  showReceiptDetails(receipt: DeliveryReceipt): void {
    this.selectedReceipt = receipt;
    this.dialog.open(this.receiptDetailsDialog, {
      width: '600px',
      maxHeight: '90vh',
      panelClass: 'receipt-dialog',
      autoFocus: false
    });
  }

  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif)$/i.test(url);
  }

  isPdf(url: string): boolean {
    return /\.pdf$/i.test(url);
  }

  openFileDialog(url: string): void {
    this.dialog.open(this.fileDialog, {
      data: { url } as FileDialogData,
      panelClass: this.isPdf(url) ? ['pdf-dialog', 'file-dialog'] : ['image-dialog', 'file-dialog'],
      maxHeight: '90vh',
      maxWidth: '90vw'
    });
  }

  sanitizeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  onFileSelectedForUpdate(event: Event, receipt: DeliveryReceipt): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      this.snackBar.open('No file selected', 'Close', { duration: 3000 });
      return;
    }

    const file = input.files[0];
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      this.snackBar.open('Invalid file type. Only images and PDFs are allowed', 'Close', { duration: 3000 });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      this.snackBar.open('File size must be less than 2MB', 'Close', { duration: 3000 });
      return;
    }

    this.selectedUpdateFile = file;
  }

  async saveUpdatedFile(receipt: DeliveryReceipt): Promise<void> {
    if (!this.selectedUpdateFile) return;

    try {
      const fileName = `${Date.now()}_${this.selectedUpdateFile.name}`;
      const filePath = fileName;

      // Upload the file
      const { error: uploadError } = await this.supabase.storage
        .from('delivery_receipts')
        .upload(filePath, this.selectedUpdateFile, {
          contentType: this.selectedUpdateFile.type,
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Update the receipt record
      const { error: updateError } = await this.supabase
        .from('delivery_receipts')
        .update({
          attached_file: fileName,
          received_by: receipt.received_by,
          delivered_date: receipt.delivered_date,
          delivered_time: receipt.delivered_time,
          status: 'Delivered'
        })
        .eq('id', receipt.id);

      if (updateError) throw updateError;

      this.snackBar.open('Delivery receipt updated successfully!', 'Close', { duration: 3000 });
      this.selectedUpdateFile = null;
      await this.loadReceipts();
      this.dialog.closeAll();
    } catch (error) {
      console.error('Error updating receipt:', error);
      this.snackBar.open('Failed to update delivery receipt', 'Close', { duration: 3000 });
    }
  }

  getStatusColor(status: string): string {
    return status === 'Delivered' ? 'primary' : 'accent';
  }

  getStatusClass(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'status-delivered';
    case 'pending':
      return 'status-pending';
    case 'processing':
      return 'status-processing';
    case 'cancelled':
      return 'status-cancelled';
    default:
      return 'status-pending';
  }
}

getStatusIcon(status: string): string {
  switch (status.toLowerCase()) {
    case 'delivered':
      return 'check_circle';
    case 'pending':
      return 'pending';
    case 'processing':
      return 'autorenew';
    case 'cancelled':
      return 'cancel';
    default:
      return 'hourglass_empty';
  }
}

getFileIcon(fileName: string): string {
  if (this.isImage(fileName)) {
    return 'image';
  } else if (this.isPdf(fileName)) {
    return 'picture_as_pdf';
  }
  return 'insert_drive_file';
}
}
