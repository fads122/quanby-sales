import { Component, OnInit, ViewChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';



interface DeliveryReceipt {
  id: string;
  delivered_to: string;
  address: string;
  delivered_by: string;
  date_received: string;
  attached_file: string;
  received_by?: string; // Added property
  delivered_date?: string; // Added property
  delivered_time?: string; // Added property
}

@Component({
  selector: 'app-delivery-receipt',
  standalone: true,
  templateUrl: './delivery-receipt.component.html',
  styleUrl: './delivery-receipt.component.css',
  imports: [
    TableModule,
    CommonModule,
    SidebarComponent,
    FormsModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
  ],
})

export class DeliveryReceiptComponent implements OnInit {
  private supabase: SupabaseClient;
  deliveryReceipts: DeliveryReceipt[] = [];
  searchQuery: string = '';
  slipForm: FormGroup;
  editMode = false;
  editReceiptId: string | null = null;
  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 0;
  fileError: string | null = null;
  selectedFile: File | null = null;
  selectedUpdateFile: File | null = null;

  @ViewChild('addSlipDialog') addSlipDialog!: TemplateRef<any>;
  @ViewChild('imageDialog') imageDialog!: TemplateRef<any>;
  @ViewChild('viewSlipDialog') viewSlipDialog!: TemplateRef<any>;

  constructor(

    private fb: FormBuilder,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private sanitizer: DomSanitizer
  ) {
    this.supabase = createClient(
      'https://xvcgubrtandfivlqcmww.supabase.co',
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh2Y2d1YnJ0YW5kZml2bHFjbXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzkxNDk4NjYsImV4cCI6MjA1NDcyNTg2Nn0.yjd-SXfzJe6XmuNpI2HsZcI9EsS9AxBXI-qukzgcZig'
    );

    this.slipForm = this.fb.group({
      delivered_to: ['', Validators.required],
      address: ['', Validators.required],
      delivered_by: ['', Validators.required],
      date_received: ['', Validators.required],
      attached_file: [''],
    });
  }

  ngOnInit() {
    this.fetchDeliveryReceipts();
  }


  openCreateSlipDialog() {
    this.editMode = false;
    this.slipForm.reset();
    this.dialog.open(this.addSlipDialog);
  }

  async createSlip() {
    if (this.slipForm.invalid || this.fileError) {
      this.snackBar.open('Please fill in all required fields correctly.', 'Close', {
        duration: 3000,
      });
      return;
    }

    try {
      // ✅ Insert Data into Supabase
      const { error } = await this.supabase
        .from('delivery_receipts')
        .insert([this.slipForm.value]);

      if (!error) {
        this.snackBar.open('Slip created successfully!', 'Close', { duration: 3000 });

        // ✅ Refresh Data & Close Dialog
        await this.fetchDeliveryReceipts();
        this.dialog.closeAll();
      } else {
        console.error("Insert error:", error.message);
      }
    } catch (error) {
      console.error('❌ Error:', error);
    }
  }


  prevPage() { if (this.currentPage > 1) this.currentPage--; }
  nextPage() { if (this.currentPage < this.totalPages) this.currentPage++; }
  calculateTotalPages() { this.totalPages = Math.ceil(this.deliveryReceipts.length / this.pageSize); }
  closeDialog() { this.dialog.closeAll(); }


  // Track selected file for updating
onFileSelectedForUpdate(event: Event, slip: DeliveryReceipt) {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) {
    this.snackBar.open('No file selected.', 'Close', { duration: 3000 });
    return;
  }

  const file = input.files[0];
  const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf'];

  if (!allowedTypes.includes(file.type)) {
    this.snackBar.open('Invalid file type.', 'Close', { duration: 3000 });
    return;
  }

  if (file.size > 2 * 1024 * 1024) {
    this.snackBar.open('File size must be less than 2MB.', 'Close', { duration: 3000 });
    return;
  }

  this.selectedUpdateFile = file;
}

// Save the updated file
// async saveUpdatedFile(slip: DeliveryReceipt) {
//   if (!this.selectedUpdateFile) return;

//   const file = this.selectedUpdateFile;
//   const fileName = `${Date.now()}_${file.name}`;
//   const filePath = fileName; // ✅ not "delivery_receipts/" + fileName

//   // Capture the current time
//   const currentTime = new Date().toLocaleTimeString();

//   // Upload the file to Supabase storage
//   const { data, error } = await this.supabase.storage
//     .from('delivery_receipts')
//     .upload(filePath, file, {
//       contentType: file.type,
//       cacheControl: '3600',
//       upsert: false,
//     });

//   if (error) {
//     this.snackBar.open(`Upload failed: ${error.message}`, 'Close', { duration: 3000 });
//     return;
//   }

//   // Update record in delivery_receipts table with additional fields
//   const { error: updateError } = await this.supabase
//     .from('delivery_receipts')
//     .update({
//       attached_file: fileName,
//       received_by: slip.received_by,
//       delivered_date: slip.delivered_date,
//       delivered_time: currentTime,  // Set the delivered time to current time
//       status: 'Delivered' // ✅ Set the status to "Delivered"
//     })
//     .eq('id', slip.id);

//   if (updateError) {
//     this.snackBar.open(`Update failed: ${updateError.message}`, 'Close', { duration: 3000 });
//     return;
//   }

//   this.snackBar.open('File and details updated successfully!', 'Close', { duration: 3000 });
//   this.selectedUpdateFile = null;
//   await this.fetchDeliveryReceipts(); // Refresh table
//   this.closeDialog();
// }
async saveUpdatedFile(slip: DeliveryReceipt) {
  if (!this.selectedUpdateFile) return;

  const file = this.selectedUpdateFile;
  const fileName = `${Date.now()}_${file.name}`;
  const filePath = fileName;

  // Upload the file to Supabase storage
  const { data, error } = await this.supabase.storage
    .from('delivery_receipts')
    .upload(filePath, file, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    this.snackBar.open(`Upload failed: ${error.message}`, 'Close', { duration: 3000 });
    return;
  }

  // Check if the delivered_time field is set, otherwise, show an error
  if (!slip.delivered_time) {
    this.snackBar.open('Please specify the delivered time.', 'Close', { duration: 3000 });
    return;
  }

  // Update record in delivery_receipts table with additional fields
  const { error: updateError } = await this.supabase
    .from('delivery_receipts')
    .update({
      attached_file: fileName,
      received_by: slip.received_by,
      delivered_date: slip.delivered_date,
      delivered_time: slip.delivered_time, // Use the input delivered time
      status: 'Delivered',
    })
    .eq('id', slip.id);

  if (updateError) {
    this.snackBar.open(`Update failed: ${updateError.message}`, 'Close', { duration: 3000 });
    return;
  }

  this.snackBar.open('File and details updated successfully!', 'Close', { duration: 3000 });
  this.selectedUpdateFile = null;
  await this.fetchDeliveryReceipts(); // Refresh table data
  this.closeDialog();
}







  // Check if the file is an image
  isImage(url: string): boolean {
    return /\.(jpg|jpeg|png|gif)$/i.test(url);
  }

  // Check if the file is a PDF
  isPdf(url: string): boolean {
    return /\.pdf$/i.test(url);
  }

  // Update slip.attached_file to full URL for display
  getFullFileUrl(fileName: string): string {
    return `https://xvcgubrtandfivlqcmww.supabase.co/storage/v1/object/public/delivery_receipts/${fileName}`;
  }



  // Sanitize the URL for embedding
  sanitizeUrl(url: string): SafeResourceUrl {
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

openPdfDialog(pdfUrl: string) {
  this.dialog.open(this.imageDialog, {
    data: { imageUrl: pdfUrl },
    panelClass: 'pdf-dialog-panel',
    width: '80vw',
    height: '80vh',
    autoFocus: false, // Prevent autofocus to avoid unnecessary re-renders
  });
}

openImageDialog(imageUrl: string) {
  this.dialog.open(this.imageDialog, {
    data: { imageUrl },
    panelClass: 'image-dialog-panel',
    autoFocus: false, // Prevent autofocus to avoid unnecessary re-renders
  });
}





async fetchDeliveryReceipts() {
  const { data, error } = await this.supabase
    .from('delivery_receipts')
    .select('*');

  if (error) {
    console.error('Error fetching delivery receipts:', error.message);
    return;
  }

  console.log('Fetched Data from Supabase:', data);

  // Use Promise.all to handle async mapping
  this.deliveryReceipts = await Promise.all(
    data.map(async slip => {
      if (!slip.attached_file) return { ...slip, attached_file: null };

      if (slip.attached_file.startsWith('http')) {
        return { ...slip, attached_file: slip.attached_file };
      }

      const { publicUrl } = this.supabase.storage
        .from('delivery_receipts')
        .getPublicUrl(slip.attached_file).data || {};

      console.log('Generated Public URL:', publicUrl);

      return { ...slip, attached_file: publicUrl || null };
    })
  );


  this.calculateTotalPages();
}


viewDetails(slip: any) {
  this.dialog.open(this.viewSlipDialog, {
    data: slip,
    width: '500px'
  });
}

openViewDialog(slip: DeliveryReceipt): void {
  this.dialog.open(this.viewSlipDialog, {
    data: { ...slip }, // Spread to ensure a fresh copy, avoid mutation issues
  });
}


  }



