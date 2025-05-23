// operational-equipment-details.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../services/supabase.service';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { SidebarComponent } from "../../nav/sidebar/sidebar.component";
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';



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

  constructor(
    private route: ActivatedRoute,
    private supabaseService: SupabaseService,
    private sanitizer: DomSanitizer
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
      return;
    }

    this.equipmentData = data;
    console.log('Barcode exists:', !!this.equipmentData?.barcode); // Add this line

    if (this.equipmentData && !this.equipmentData.barcode && this.equipmentData.serial_number) {
      console.log('Generating barcode...');
      await this.generateBarcode();
    }
  } catch (err) {
    console.error('Unexpected error loading equipment:', err);
  }
}

  async loadEquipmentMovements() {
    try {
      const movements = await this.supabaseService.getEquipmentMovements(this.equipmentId);
      this.equipmentMovements = movements || [];
    } catch (error) {
      console.error('Error loading movements:', error);
      this.equipmentMovements = [];
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
      }
    } catch (error) {
      console.error('Error generating barcode:', error);
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
    this.returnSlipUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
      url.endsWith('.docx')
        ? `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`
        : url
    );
    this.showReturnSlipModal = true;
  }

  closeReturnSlipModal() {
    this.showReturnSlipModal = false;
    this.returnSlipUrl = null;
  }
}
