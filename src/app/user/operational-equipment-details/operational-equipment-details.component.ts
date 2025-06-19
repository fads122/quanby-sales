// operational-equipment-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { BreadcrumbComponent } from "../../breadcrumb/breadcrumb.component";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '../../../environments/environment';



// Update your interface to make optional fields explicit
interface OperationalEquipment {
  id: string;
  name: string | null; // Make nullable if it can be null
  quantity: number | null;
  images: string[] | null;
  serial_number: string | null;
  qr_code: string | null;
  barcode: string | null;
  date_acquired: string | null;
  product_type: string | null;
  status: string | null;
  brand: string | null;
  model: string | null;
  condition: string | null;
  damaged: boolean | null;
  repair_logs: any[] | null;
  return_slip: string | null;
  description?: string | null;
  property_number?: string | null;
  size?: string | null;
  color?: string | null;
  software_name?: string | null;
}

@Component({
  selector: 'app-operational-equipment-details',
  standalone: true,
  templateUrl: './operational-equipment-details.component.html',
  styleUrls: ['./operational-equipment-details.component.css'],
  imports: [
    CommonModule,
    FormsModule,
    SidebarComponent,
    BreadcrumbComponent,
    MatSnackBarModule,
  ],
})
export class OperationalEquipmentDetailsComponent implements OnInit {
  equipmentId: string = '';
  equipmentData: OperationalEquipment | null = null;
  equipmentMovements: any[] = [];
  selectedQRCode: string | null = null;
  selectedBarcode: string | null = null;
  returnSlipUrl: SafeResourceUrl | null = null;
  showQRModal = false;
  showBarcodeModal = false;
  showReturnSlipModal = false;
  isLoading = true;
  error: string | null = null;
  isCollapsed = false;

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private sanitizer: DomSanitizer,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.equipmentId = this.route.snapshot.paramMap.get('id') || '';
    this.loadEquipmentDetails();
    this.loadEquipmentMovements();
  }

  async loadEquipmentDetails() {
    console.log('Loading equipment details for ID:', this.equipmentId);
    try {
      const { data, error } = await this.supabaseService.getInHouseEquipmentById(this.equipmentId);
      console.log('API Response:', { data, error });

      if (error) {
        console.error('Error loading equipment:', error);
        this.snackBar.open('Error loading equipment details.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        });
        return;
      }

      this.equipmentData = data;

      // Parse repair_logs if it's a string
      if (this.equipmentData && typeof this.equipmentData.repair_logs === 'string') {
        try {
          this.equipmentData.repair_logs = JSON.parse(this.equipmentData.repair_logs);
        } catch (e) {
          console.error('Failed to parse repair_logs:', e);
          this.equipmentData.repair_logs = [];
        }
      }

      console.log('Barcode exists:', !!this.equipmentData?.barcode);

      if (this.equipmentData && !this.equipmentData.barcode && this.equipmentData.serial_number) {
        console.log('Generating barcode...');
        await this.generateBarcode();
      }
    } catch (err) {
      console.error('Unexpected error loading equipment:', err);
      this.snackBar.open('An unexpected error occurred while loading equipment details.', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      });
    }
  }

  async loadEquipmentMovements() {
    try {
      const movements = await this.supabaseService.getEquipmentMovements(this.equipmentId);
      this.equipmentMovements = movements || [];
    } catch (error) {
      console.error('Error loading movements:', error);
      this.equipmentMovements = [];
      this.snackBar.open('Error loading equipment movements.', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      });
    }
  }

  async generateBarcode() {
    if (!this.equipmentData) return;

    try {
      const canvas = document.createElement('canvas');
      const JsBarcode = (await import('jsbarcode')).default;
      JsBarcode(canvas, this.equipmentData.serial_number!, { format: 'CODE128' });

      const barcodeUrl = canvas.toDataURL();
      const { error } = await this.supabaseService
        .from('inhouse')
        .update({ barcode: barcodeUrl })
        .eq('id', this.equipmentData.id);

      if (!error && this.equipmentData) {
        this.equipmentData.barcode = barcodeUrl;
        this.snackBar.open('Barcode generated successfully.', 'Close', {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['success-snackbar']
        });
      } else {
        throw error;
      }
    } catch (error) {
      console.error('Error generating barcode:', error);
      this.snackBar.open('Error generating barcode.', 'Close', {
        duration: 3000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['error-snackbar']
      });
    }
  }

  openQRModal(qrCode: string) {
    this.selectedQRCode = qrCode;
    this.showQRModal = true;
  }

openBarcodeModal(barcode: string) {
    this.selectedBarcode = barcode;
    this.showBarcodeModal = true; // Add this line
}

   closeQRModal() {
    this.showQRModal = false;
    this.selectedQRCode = null;
  }

  closeBarcodeModal() {
    this.showBarcodeModal = false;
    this.selectedBarcode = null;
  }

openReturnSlipModal(url: string) {
  this.returnSlipUrl = url.endsWith('.docx')
    ? `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
    : url;
  this.showReturnSlipModal = true;
}

  closeReturnSlipModal() {
    this.showReturnSlipModal = false;
    this.returnSlipUrl = null;
  }

  openReturnSlip(url: string) {
    const finalUrl = url.endsWith('.docx')
      ? `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
      : url;
    window.open(finalUrl, '_blank');
  }

    getSupabaseImageUrl(filename: string): string {
  // Use environment variable instead of hardcoded URL
  return `${environment.SUPABASE_URL}/storage/v1/object/public/equipment-images/${filename}`;
}

  // Add method to handle sidebar collapse
  onSidebarCollapsed(collapsed: boolean) {
    this.isCollapsed = collapsed;
  }
}
