import { Component, OnInit, Inject, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import { SupabaseService } from '../../services/supabase.service';
import { FormsModule } from '@angular/forms';
import { NgIf, CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { trigger, state, style, transition, animate } from '@angular/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import * as tf from '@tensorflow/tfjs';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import { MatSnackBarModule } from '@angular/material/snack-bar';



interface InhouseEquipment {
  id?: string;
  name: string;
  quantity: number;
  images: string[];
  serial_number: string;
  qr_code: string;
  barcode: string;
  date_acquired: string;
  product_type: string;
  brand: string;
  model: string;
  condition: string;
  damaged: boolean;
  repair_logs: any[];
  return_slip: string | File;
  inactive_reason?: string;
  inactive_location?: string;
  status?: string;
  // Add new properties
  property_number?: string;
  size?: string;
  color?: string;
  software_name?: string;
  subscription_expiry?: string;
}

interface CategoryContext {
  [key: string]: string;
}

interface CategorySpecs {
  [key: string]: string[];
}


@Component({
  selector: 'app-add-equipment',
  standalone: true,
  imports: [FormsModule, CommonModule, NgIf, MatDialogModule, MatIconModule, MatProgressSpinnerModule,  MatSnackBarModule],
  templateUrl: './add-equipment.component.html',
  styleUrls: ['./add-equipment.component.css'],
  animations: [
  trigger('dialogContainer', [
    transition(':enter', [
      style({ opacity: 0, transform: 'scale(0.9) translateY(20px)' }),
      animate('200ms ease-out',
        style({ opacity: 1, transform: 'scale(1) translateY(0)' })
      )
    ]),
    transition(':leave', [
      animate('150ms ease-in',
        style({ opacity: 0, transform: 'scale(0.95) translateY(10px)' })
      )
    ])
  ])
]
})

export class AddEquipmentComponent implements OnInit {
  isEditMode = false;
  suppliers: any[] = [];
  equipmentId: string | null = null;
  supplierEquipments: any[] = [];
  isFormOpen = false;
  selectedFormType: string = 'pcParts';
  today: string = new Date().toISOString().split('T')[0];
  newRepairLogVisible = false;
  newRepairLog = { date: '', description: '' };
  isSubmitting = false;

  // Add these properties
  isLoading = false;
  loadingMessage = 'Adding equipment...';

  pcPartsDataArray = [{
    category: '',
    name: '',
    model: '',
    brand: '',
    supplier: '',
    cost: 0,
    quantity: 0,
    images: [] as string[]
  }];

  inhouseEquipment: any = {
    name: '',
    brand: '',       // Add this
    model: '',       // Add this
    quantity: 1,
    serial_number: '',
    qr_code: '',
    barcode: '',
    images: [] as string[],
    date_acquired: new Date().toISOString().split('T')[0],
    product_type: 'operational_equipment'
  };

inhouseEquipmentArray: InhouseEquipment[] = [{
  name: '',
  quantity: 1,
  images: [],
  serial_number: '',
  qr_code: '',
  barcode: '',
  date_acquired: new Date().toISOString().split('T')[0],
  product_type: 'operational_equipment',
  brand: '',
  model: '',
  condition: '',
  damaged: false,
  repair_logs: [],
  return_slip: '',
  // Add any other required properties from your interface
}];

  productCategories = [
    { value: 'operational_equipment', label: 'Operational Equipment' },
    { value: 'supplies', label: 'Supplies' },
    { value: 'software_subscriptions', label: 'Software/Subscriptions' },
    { value: 'operational_assets', label: 'Operational Assets' }
  ];

  pcPartCategories: string[] = [
    'CPU', 'CPU Cooler', 'Motherboard', 'Memory', 'Storage', 'Video Card', 'Case',
    'Power Supply', 'Operating System', 'Monitor',
    'Expansion Cards / Networking - Sound Cards',
    'Expansion Cards / Networking - Wired Network Adapters',
    'Expansion Cards / Networking - Wireless Network Adapters',
    'Peripherals - Headphones', 'Peripherals - Keyboards', 'Peripherals - Mice',
    'Peripherals - Speakers', 'Peripherals - Webcams',
    'Accessories / Other'
  ];

  // 🔹 Equipment Data Array
  equipmentDataArray = [{
    serial_no: '',
    name: '',
    model: '',
    brand: '',
    supplier: '',
    supplier_cost: 0,
    srp: 0,
    quantity: 0,
    location: '',
    description: '',
    variety: '',
    qr_code: '',
    product_images: [] as string[],
    repair_logs: [] as any[],
    return_slip: '',
    damaged: false,
    condition: '',
    date_acquired: '',  // 🔹 New field
    lifespan_months: 12, // 🔹 Default lifespan of 12 months
    barcode: '',
    item_type: 'Expendable',
    category: '',
    brochure: null as File | null,
    brochure_url: '',
    ownership_type: 'private'
  }];

  private model: any;
  private isModelLoading = false;

  // Add these category descriptions
private categoryDescriptions: { [key: string]: string } = {
  'CPU': 'high-performance central processing unit designed for optimal computing power and multitasking capabilities',
  'CPU Cooler': 'efficient thermal solution for maintaining optimal processor temperatures with advanced cooling technology',
  'Motherboard': 'advanced system board providing essential connectivity and expansion options with modern interface support',
  'Memory': 'high-speed RAM module for smooth multitasking and enhanced system performance with reliable data handling',
  'Storage': 'reliable data storage solution with optimized read/write speeds and secure data management',
  'Video Card': 'powerful graphics processing unit for superior visual performance and gaming capabilities',
  'Case': 'durable computer chassis with excellent airflow and component compatibility for optimal system cooling',
  'Power Supply': 'stable and efficient power delivery unit with protection features and reliable voltage regulation',
  'Operating System': 'comprehensive software platform providing user interface and system management capabilities',
  'Monitor': 'high-quality display panel with crisp image reproduction and eye-care technology',
  'Expansion Cards / Networking - Sound Cards': 'advanced audio processing card for superior sound quality and audio management',
  'Expansion Cards / Networking - Wired Network Adapters': 'reliable ethernet connectivity solution for stable network performance',
  'Expansion Cards / Networking - Wireless Network Adapters': 'high-speed wireless connectivity solution with broad compatibility',
  'Peripherals - Headphones': 'comfortable audio device with precise sound reproduction and noise isolation',
  'Peripherals - Keyboards': 'responsive input device with ergonomic design and customizable features',
  'Peripherals - Mice': 'precise pointing device with ergonomic comfort and adjustable sensitivity',
  'Peripherals - Speakers': 'clear audio output device with balanced sound reproduction and rich bass response',
  'Peripherals - Webcams': 'high-definition video capture device with clear communications and low-light performance',
  'Accessories / Other': 'essential computing accessories designed for enhanced functionality and user experience'
};

private featuresByCategory: { [key: string]: string[] } = {
  'CPU': [
    'multiple processing cores for parallel computing',
    'advanced cache system for quick data access',
    'integrated graphics capabilities',
    'power-efficient design',
    'overclocking support',
    'compatible with latest motherboard sockets'
  ],
  'CPU Cooler': [
    'efficient heat dissipation design',
    'quiet operation technology',
    'customizable RGB lighting',
    'compact form factor',
    'easy installation mechanism',
    'compatible with multiple CPU sockets'
  ],
  'Motherboard': [
    'multiple PCIe expansion slots',
    'advanced BIOS features',
    'robust power delivery system',
    'high-speed RAM support',
    'integrated audio solution',
    'multiple storage connectors'
  ],
  'Memory': [
    'high-frequency operation',
    'low latency timings',
    'XMP profile support',
    'heat spreader design',
    'stable performance',
    'compatibility with latest platforms'
  ],
  'Storage': [
    'high data transfer speeds',
    'large storage capacity',
    'reliable data protection',
    'advanced caching system',
    'durable construction',
    'power loss protection'
  ],
  'Video Card': [
    'powerful graphics processor',
    'high-speed memory interface',
    'advanced cooling system',
    'multiple display support',
    'ray tracing capabilities',
    'efficient power consumption'
  ],
  'Monitor': [
    'high refresh rate display',
    'wide color gamut support',
    'adaptive sync technology',
    'ergonomic stand design',
    'multiple input ports',
    'built-in speakers'
  ],
  'Peripherals - Mice': [
    'ergonomic design for comfortable extended use',
    'precise optical/laser sensor tracking',
    'adjustable DPI settings',
    'programmable macro buttons',
    'durable switches rated for millions of clicks',
    'customizable RGB lighting'
  ],
  'Peripherals - Keyboards': [
    'mechanical/membrane key switches',
    'anti-ghosting capability',
    'customizable backlighting',
    'multimedia control keys',
    'built-in wrist rest',
    'spill-resistant design'
  ],
  'Peripherals - Headphones': [
    'high-fidelity audio drivers',
    'comfortable ear cushions',
    'noise isolation technology',
    'detachable microphone',
    'inline volume controls',
    'durable construction'
  ],
  'Peripherals - Speakers': [
    'clear audio reproduction',
    'powerful bass response',
    'multiple input options',
    'built-in amplifier',
    'compact design',
    'wireless connectivity'
  ],
  'Peripherals - Webcams': [
    'HD/4K video capture',
    'auto-focus capability',
    'low-light performance',
    'built-in microphone',
    'wide-angle lens',
    'privacy shutter'
  ]
};

private categorySearchTerms: { [key: string]: string[] } = {
  'CPU': [
    'processor', 'gaming cpu', 'desktop cpu', 'workstation processor',
    'intel', 'amd', 'ryzen', 'core i7', 'core i9', 'threadripper',
    'multi core', 'processing power', 'computer processor'
  ],
  'Memory': [
    'ram', 'ddr4', 'ddr5', 'gaming memory', 'desktop ram',
    'high performance ram', 'rgb ram', 'memory upgrade',
    'corsair', 'gskill', 'crucial', 'kingston'
  ],
  'Storage': [
    'ssd', 'hdd', 'nvme', 'm.2', 'hard drive', 'solid state drive',
    'external drive', 'samsung', 'western digital', 'seagate',
    'storage upgrade', 'fast storage'
  ],
  'Video Card': [
    'gpu', 'graphics card', 'gaming gpu', 'nvidia', 'amd',
    'rtx', 'radeon', 'geforce', '4k gaming', 'ray tracing',
    'mining gpu', 'video editing gpu'
  ],
  'Monitor': [
    'gaming monitor', 'display', 'screen', '4k monitor', 'ultrawide',
    'curved monitor', 'high refresh rate', '144hz', '240hz',
    'asus', 'lg', 'samsung', 'dell'
  ],
  'Peripherals - Mice': [
    'gaming mouse', 'wireless mouse', 'ergonomic mouse', 'bluetooth mouse',
    'logitech', 'razer', 'corsair', 'dpi adjustable', 'rgb mouse',
    'mouse for gaming', 'office mouse'
  ],
  'Peripherals - Keyboards': [
    'mechanical keyboard', 'gaming keyboard', 'wireless keyboard',
    'rgb keyboard', 'cherry mx', 'tkl keyboard', 'full size keyboard',
    'razer', 'corsair', 'logitech', 'ducky'
  ]
};


  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public dialogRef: MatDialogRef<AddEquipmentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any, // Inject dialog data
    private snackBar: MatSnackBar
  ) {}

  async ngOnInit() {
    await this.loadSuppliers();

    // ✅ Check if data is passed via MatDialog
    if (this.data && this.data.isEditMode && this.data.equipmentData) {
      this.isEditMode = true;
      this.equipmentId = this.data.equipmentData.id;

      // ✅ Populate the form fields with the equipment data
      this.equipmentDataArray = [{
        serial_no: this.data.equipmentData.serial_no || '',
        name: this.data.equipmentData.name || '',
        model: this.data.equipmentData.model || '',
        brand: this.data.equipmentData.brand || '',
        supplier: this.data.equipmentData.supplier || '',
        supplier_cost: this.data.equipmentData.supplier_cost ?? 0,
        srp: this.data.equipmentData.srp ?? 0,
        quantity: this.data.equipmentData.quantity ?? 1,
        location: this.data.equipmentData.location || '',
        description: this.data.equipmentData.description || '',
        variety: this.data.equipmentData.variety || '',
        qr_code: this.data.equipmentData.qr_code || '',
        product_images: this.data.equipmentData.product_images ? [...this.data.equipmentData.product_images] : [],
        repair_logs: this.data.equipmentData.repair_logs ? [...this.data.equipmentData.repair_logs] : [],
        return_slip: this.data.equipmentData.return_slip || '',
        damaged: this.data.equipmentData.damaged ?? false,
        condition: this.data.equipmentData.condition || '',
        date_acquired: this.data.equipmentData.date_acquired || new Date().toISOString().split('T')[0],
        lifespan_months: this.data.equipmentData.lifespan_months ?? 12,
        barcode: this.data.equipmentData.barcode || '',
        item_type: this.data.equipmentData.item_type || 'Expendable',
        category: '',
        brochure: null as File | null,
        brochure_url: '',
        ownership_type: this.data.equipmentData.ownership_type || 'private'
      }];

      console.log('🔄 Editing Equipment:', this.equipmentDataArray);
    } else {
      console.log('➕ Adding New Equipment');
      this.resetForm();
    }
  }

  async handleInhouseImageUpload(event: Event, index: number): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const urls = await this.uploadImages(input.files, 'equipment-images');
      this.inhouseEquipmentArray[index].images = urls;
      this.cdRef.detectChanges();
    }
  }

// Add method to remove in-house equipment form
removeInhouseEquipment(index: number) {
  this.inhouseEquipmentArray.splice(index, 1);
}

async addInhouseEquipment() {
  const newEquipment: InhouseEquipment = {
  name: '',
  quantity: 1,
  images: [],
  serial_number: '',
  qr_code: '',
  barcode: '',
  date_acquired: new Date().toISOString().split('T')[0],
  product_type: 'operational_equipment',
  brand: '',
  model: '',
  condition: '',
  damaged: false,
  repair_logs: [],
  return_slip: ''
};

  // Generate property number immediately
  await this.generatePropertyNumber(newEquipment);
  this.inhouseEquipmentArray.push(newEquipment);
  this.cdRef.detectChanges();
}

  onSupplierChange(event: any, index: number) {
    const selectedSupplier = event.target.value;
    this.loadSupplierEquipment(selectedSupplier);

    // ✅ Preserve existing data while updating only the supplier field
    this.equipmentDataArray[index] = {
      ...this.equipmentDataArray[index], // Keep existing values
      supplier: selectedSupplier // Update supplier only
    };
  }

  onClose(): void {
    this.dialogRef.close();
  }

onConditionChange(equipment: InhouseEquipment) {
  // Clear inactive fields if condition is changed from Inactive
  if (equipment.condition !== 'Inactive') {
    equipment.inactive_reason = undefined;
    equipment.inactive_location = undefined;
  }
}

async loadSupplierEquipment(supplierName: string) {
  if (!supplierName) return;

  const { data, error } = await this.supabaseService
    .from('equipments')
    .select('id, name, model, brand, supplier_cost, srp, product_images')
    .eq('supplier', supplierName);

  if (error) {
    console.error("❌ Error fetching supplier's equipment:", error);
    return;
  }

  this.supplierEquipments = data;
  console.log("✅ Supplier Equipment Loaded:", this.supplierEquipments);
}

  async loadSuppliers() {
    const data = await this.supabaseService.getSuppliers();
    if (data) {
      this.suppliers = data;
    } else {
      console.error('❌ Failed to load suppliers.');
    }
  }

  // Modify the onSubmit method
  async onSubmit() {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Processing equipment submission...';

      for (const equipment of this.equipmentDataArray) {
        // Ensure category is set
        if (!equipment.category) {
          equipment.category = 'Default Category';
        }

        // Set default date if not provided
        if (!equipment.date_acquired) {
          equipment.date_acquired = new Date().toISOString().split('T')[0];
        }

        // Handle image uploads
        this.loadingMessage = 'Uploading images...';
        const imageInput = document.getElementById(`equipmentImageInput${this.equipmentDataArray.indexOf(equipment)}`) as HTMLInputElement;
        let imageUrls: string[] = [];
        if (imageInput && imageInput.files) {
          imageUrls = await this.uploadImages(imageInput.files, 'equipment-images');
        }

        // Handle brochure upload if exists
        if (equipment.brochure) {
          this.loadingMessage = 'Uploading brochure...';
          const brochureUrl = await this.supabaseService.uploadFile(equipment.brochure, 'equipment-brochures');
          if (brochureUrl) {
            equipment.brochure_url = brochureUrl;
          }
        }

        // Handle update or add equipment
        if (this.isEditMode && this.equipmentId) {
          this.loadingMessage = 'Updating equipment...';
          const updateResult = await this.supabaseService.updateEquipment(
            this.equipmentId,
            equipment,
            this.router
          );

          if (updateResult) {
            this.loadingMessage = 'Generating equipment data...';
            await this.generateAndStoreEmbedding(this.equipmentId, equipment);

            this.dialogRef.close({
              success: true,
              equipment: updateResult,
              isEditMode: true,
              action: 'update'
            });
            this.showSuccessAnimation('Equipment updated successfully!');
            return;
          } else {
            console.error(`❌ Failed to update equipment: ${equipment.name}`);
            throw new Error('Failed to update equipment');
          }
        } else {
          this.loadingMessage = 'Adding new equipment...';
          const result = await this.supabaseService.addEquipment(equipment);
          if (result) {
            this.loadingMessage = 'Generating equipment data...';
            await this.generateAndStoreEmbedding(result.id, equipment);

            this.loadingMessage = 'Storing cost history...';
            const initialCostEntry = {
              supplier_cost: equipment.supplier_cost,
              srp: equipment.srp,
              date_updated: equipment.date_acquired
            };

            await this.supabaseService.addCostHistory(result.id, initialCostEntry);

            if (equipment.item_type === 'Semi-Expendable') {
              this.loadingMessage = 'Scheduling notifications...';
              const expiryDate = new Date(equipment.date_acquired);
              expiryDate.setMonth(expiryDate.getMonth() + equipment.lifespan_months);
              const notificationStart = new Date(expiryDate);
              notificationStart.setMonth(notificationStart.getMonth() - 1);

              const alreadyScheduled = await this.supabaseService.checkExistingNotification(equipment.name, notificationStart);

              if (!alreadyScheduled) {
                await this.scheduleExpiryNotifications(equipment);
              }
            }

            this.dialogRef.close({
              success: true,
              equipment: result,
              isEditMode: false,
              action: 'add'
            });
            this.showSuccessAnimation('Equipment added successfully!');
            return;
          } else {
            console.error('❌ Failed to add equipment');
            throw new Error('Failed to add equipment');
          }
        }
      }
    } catch (error) {
      console.error('❌ Error during submission:', error);
      this.dialogRef.close({ success: false, error: error });
      alert('Failed to submit equipment. Please try again.');
    } finally {
      this.isLoading = false;
    }
  }

  // Similarly update submitInhouseEquipment method
  async submitInhouseEquipment() {
    try {
      this.isLoading = true;
      this.loadingMessage = 'Processing in-house equipment submission...';
      this.isSubmitting = true;

      for (const equipment of this.inhouseEquipmentArray) {
        if (!equipment.name || !equipment.serial_number) {
          alert('Please provide both Name and Serial Number for all equipment.');
          return;
        }

        // Generate property number before saving
        await this.generatePropertyNumber(equipment);

        const uuid = self.crypto.randomUUID();

        // Generate QR code and barcode
        this.loadingMessage = 'Generating QR code and barcode...';
        await this.generateQRCode(equipment);
        await this.generateInhouseBarcode(equipment);

        // Upload images
        this.loadingMessage = 'Uploading images...';

        // Handle return slip
        let returnSlipUrl = '';
        if (equipment.return_slip instanceof File) {
          this.loadingMessage = 'Uploading return slip...';
          returnSlipUrl = await this.supabaseService.uploadFile(equipment.return_slip, 'equipment-images');
        } else if (typeof equipment.return_slip === 'string') {
          returnSlipUrl = equipment.return_slip;
        }

        const equipmentData = {
          id: uuid,
          name: equipment.name,
          brand: equipment.brand,
          model: equipment.model,
          quantity: equipment.quantity,
          images: equipment.images || [],  // Ensure images array exists
          serial_number: equipment.serial_number,  // Use correct property name
          qr_code: equipment.qr_code,
          barcode: equipment.barcode,
          date_acquired: equipment.date_acquired,
          product_type: equipment.product_type,
          status: equipment.condition === 'Inactive' ? 'inactive' : 'available',
          condition: equipment.condition,
          damaged: equipment.damaged,
          repair_logs: equipment.repair_logs,
          return_slip: returnSlipUrl,
          inactive_reason: equipment.condition === 'Inactive' ? equipment.inactive_reason : null,
          inactive_location: equipment.condition === 'Inactive' ? equipment.inactive_location : null,
          // Add Property Details
          property_number: equipment.property_number,
          size: equipment.size || null,
          color: equipment.color || null,
          software_name: equipment.software_name || null,
          subscription_expiry: equipment.subscription_expiry || null
        };

        this.loadingMessage = 'Saving equipment data...';
        const { data, error } = await this.supabaseService
          .from('inhouse')
          .insert([equipmentData])
          .select();

        if (error) throw error;
        console.log('✅ Equipment saved with property details:', equipmentData);
      }

      this.dialogRef.close({
        success: true,
        isInhouse: true,
        action: 'add'
      });
      this.showSuccessAnimation('In-house equipment added successfully!');
    } catch (error) {
      console.error('Error submitting equipment:', error);
      this.dialogRef.close({ success: false, error: error });
      alert('Failed to submit equipment. Please try again.');
    } finally {
      this.isLoading = false;
      this.isSubmitting = false;
    }
  }

  showSuccessAnimation(message: string) {
    const animDiv = document.createElement('div');
    animDiv.className = 'success-animation';
    animDiv.textContent = message;
    document.body.appendChild(animDiv);

    setTimeout(() => {
      animDiv.style.transition = 'opacity 0.5s';
      animDiv.style.opacity = '0';
      setTimeout(() => animDiv.remove(), 500);
    }, 1500);
  }

  // ✅ Function to reset form
  private resetForm() {
    this.equipmentDataArray = [{
      serial_no: '',
      name: '',
      model: '',
      brand: '',
      supplier: '',
      supplier_cost: 0,
      srp: 0,
      quantity: 0,
      location: '',
      description: '',
      variety: '',
      qr_code: '',
      product_images: [],
      repair_logs: [{
        repair_details: '',
        repair_status: 'New',
        repair_date: this.today
      }], // Initialize with one empty log
      return_slip: '',
      damaged: false,
      condition: '',
      date_acquired: new Date().toISOString().split('T')[0],
      lifespan_months: 12,
      barcode: '',
      item_type: 'Expendable',
      category: '',
      brochure: null as File | null,
      brochure_url: '',
      ownership_type: 'private'
    }];

    this.isEditMode = false;
  }

  async generateQRCode(equipment: any) {
    const data = `${equipment.serial_no}-${equipment.name}`;
    try {
      const qrCode = await QRCode.toDataURL(data);
      equipment.qr_code = qrCode;
    } catch (error) {
      console.error('Error generating QR code:', error);
    }
  }

  async generateBarcode(equipment: InhouseEquipment): Promise<string> {
    return new Promise((resolve) => {
      if (!equipment.serial_number) {
        console.warn('No serial number provided for barcode generation');
        resolve('');
        return;
      }

      const canvas = document.createElement('canvas');

      try {
        JsBarcode(canvas, equipment.serial_number, {
          format: "CODE128",
          width: 2,
          height: 100,
          displayValue: true,
          fontSize: 20,
          margin: 10,
          background: "#ffffff"
        });

        const barcodeData = canvas.toDataURL('image/png');
        equipment.barcode = barcodeData; // Update the equipment object
        console.log('Generated barcode for serial:', equipment.serial_number);
        resolve(barcodeData);
      } catch (error) {
        console.error('Error generating barcode:', error);
        resolve('');
      }
    });
  }

  async uploadImages(files: FileList, bucketName: "equipment-images" | "profile-pictures" | "equipment-brochures"): Promise<string[]> {
    const urls: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const url = await this.supabaseService.uploadFile(file, bucketName);
        if (url) {
          urls.push(url);
        }
      } catch (error) {
        console.error(`Error uploading image ${file.name}:`, error);
      }
    }

    return urls;
  }


  handleFileInput(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.files) {
      this.uploadImages(input.files, 'equipment-images') // ✅ Ensuring correct bucket
        .then((urls) => {
          this.equipmentDataArray[index].product_images = urls;
        });
    }
  }


  async handleReturnSlip(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      const url = await this.supabaseService.uploadFile(file, 'equipment-images'); // ✅ Ensuring correct bucket
      if (url) {
        this.equipmentDataArray[index].return_slip = url;
      } else {
        console.error('❌ Failed to upload return slip.');
      }
    }
  }


  addRepairLog(equipment: any) {
    equipment.repair_logs.push({ repair_details: '', repair_status: 'New', repair_date: '' });
  }

  removeRepairLog(equipment: any, index: number) {
    equipment.repair_logs.splice(index, 1);
  }

  // Returns an empty equipment template
private getEmptyEquipmentTemplate() {
  return {
    serial_no: '',
    name: '',
    model: '',
    brand: '',
    supplier: '',
    supplier_cost: 0,
    srp: 0,
    quantity: 0,
    location: '',
    description: '',
    variety: '',
    qr_code: '',
    product_images: [] as string[],
    repair_logs: [] as any[],
    return_slip: '',
    damaged: false,
    condition: '',
    date_acquired: '',
    lifespan_months: 12,
    barcode: '',
    item_type: 'Expendable',
    category: '',
    brochure: null as File | null,
    brochure_url: '',
    ownership_type: 'private'
  };
}

addEquipment() {
  // ✅ Get last added equipment to pre-fill values
  const lastEquipment = this.equipmentDataArray[this.equipmentDataArray.length - 1] || {};

  this.equipmentDataArray.push({
    serial_no: '', // Keep Serial No blank (to ensure uniqueness)
    name: lastEquipment.name || '',
    model: lastEquipment.model || '',
    brand: lastEquipment.brand || '',
    supplier: lastEquipment.supplier || '',
    supplier_cost: lastEquipment.supplier_cost || 0, // ✅ Pre-fill supplier cost
    srp: lastEquipment.srp || 0, // ✅ Pre-fill SRP
    quantity: 0,
    location: lastEquipment.location || '',
    description: '',
    variety: '',
    qr_code: '',
    product_images: [],
    repair_logs: [{
      repair_details: '',
      repair_status: 'New',
      repair_date: this.today
    }], // Initialize with one empty repair log
    return_slip: '',
    damaged: false,
    condition: '',
    date_acquired: '',
    lifespan_months: 12,
    barcode: '',
    item_type: lastEquipment.item_type || 'Expendable',
    category: '',
    brochure: null as File | null,
    brochure_url: '',
    ownership_type: lastEquipment.ownership_type || 'private'
  });

  console.log("➕ Added new equipment with pre-filled values:", this.equipmentDataArray[this.equipmentDataArray.length - 1]);
}

  selectExistingEquipment(event: any, index: number) {
    const selectedEquipmentId = event.target.value;
    if (!selectedEquipmentId) return;

    const selectedEquipment = this.supplierEquipments.find(e => e.id == selectedEquipmentId);
    if (!selectedEquipment) return;

    // Populate the selected equipment's details
    this.equipmentDataArray[index] = {
      serial_no: '', // Keep blank since it's unique
      name: selectedEquipment.name,
      model: selectedEquipment.model,
      brand: selectedEquipment.brand,
      supplier: this.equipmentDataArray[index].supplier, // Keep supplier the same
      supplier_cost: selectedEquipment.supplier_cost,
      srp: selectedEquipment.srp,
      quantity: 0, // Default quantity
      location: selectedEquipment.location || '',
      description: selectedEquipment.description || '',
      variety: selectedEquipment.variety || '',
      condition: selectedEquipment.condition || '',
      item_type: selectedEquipment.item_type || '',
      qr_code: '',
      product_images: selectedEquipment.product_images ? [...selectedEquipment.product_images] : [],
      repair_logs: [],
      return_slip: '',
      damaged: false,
      date_acquired: '',
      lifespan_months: 12,
      barcode: '',
      category: '',
      brochure: null as File | null,
      brochure_url: '',
      ownership_type: selectedEquipment.ownership_type || 'private'
    };

    // ✅ Hide the dropdown after selection
    this.supplierEquipments = [];
    console.log("✅ Form Pre-filled with Existing Equipment:", this.equipmentDataArray[index]);
  }

  removeEquipment(index: number) {
    this.equipmentDataArray.splice(index, 1);
  }

  handleBrochureUpload(event: any, index: number) {
    const file = event.target.files[0];
    if (file) {
      // Basic validation - check file type
      const validTypes = ['application/pdf', 'application/msword',
                         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                         'application/vnd.ms-powerpoint',
                         'application/vnd.openxmlformats-officedocument.presentationml.presentation'];

      if (!validTypes.includes(file.type)) {
        alert('Please upload a valid file (PDF, DOC, DOCX, PPT, PPTX)');
        return;
      }

      // Check file size (e.g., 10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert('File size should be less than 10MB');
        return;
      }

      this.equipmentDataArray[index].brochure = file;
    }
  }

  // 🔥 Handle Type Change (Show/Hide Lifespan Field)
  handleItemTypeChange(equipment: any) {
    if (equipment.itemType === 'Expendable') {
      equipment.lifespan_months = null; // Reset lifespan if Expendable is selected
    } else {
      equipment.lifespan_months = 12; // Set default lifespan if Semi-Expendable is selected
    }
  }

  // ✅ Schedule Weekly Expiry Notifications
  async scheduleExpiryNotifications(equipment: any) {
    const dateAcquired = new Date(equipment.date_acquired);
    const lifespan_months = equipment.lifespan_months; // ✅ Use correct property name

    // 🔹 Calculate the expiry date
    const expiryDate = new Date(dateAcquired);
    expiryDate.setMonth(expiryDate.getMonth() + lifespan_months);

    // 🔹 Start sending notifications **one month before expiry**
    const notificationStart = new Date(expiryDate);
    notificationStart.setMonth(notificationStart.getMonth() - 1);

    console.log("📢 Scheduling notifications for:", equipment.name);
    console.log("🔵 Expiry Date:", expiryDate.toISOString().split('T')[0]);
    console.log("🔔 Notifications Start On:", notificationStart.toISOString().split('T')[0]);

    let notificationDate = new Date(notificationStart);

    while (notificationDate <= expiryDate) {
      // ✅ Convert to Philippines Time (UTC+8)
      notificationDate.setHours(notificationDate.getHours() + 8);

      // ✅ Check if notification is already scheduled for this week
      const alreadyExists = await this.supabaseService.checkScheduledNotification(equipment.name, notificationDate);

      if (!alreadyExists) {
        // ✅ Schedule only ONE notification per week
        await this.supabaseService.scheduleNotification({
          message: `⚠ Equipment "${equipment.name}" will expire on ${expiryDate.toDateString()}.`,
          status: 'pending',
          scheduled_for: notificationDate.toISOString(),
        });

        console.log("✅ Notification scheduled for future date:", notificationDate.toISOString().split('T')[0]);

        // 🔹 Stop inserting all at once, schedule **one at a time**
        break;
      } else {
        console.log("⏳ Notification already scheduled. Skipping...");
      }

      // 🔹 Move to the **next week** instead of inserting all at once
      notificationDate.setDate(notificationDate.getDate() + 7);
    }
  }

  // Add to your component class
addInhouseRepairLog(equipment: any) {
  if (!equipment.repair_logs) {
    equipment.repair_logs = [];
  }
  equipment.repair_logs.push({
    repair_details: '',
    repair_status: 'New',
    repair_date: this.today
  });
}

removeInhouseRepairLog(equipment: any, index: number) {
  equipment.repair_logs.splice(index, 1);
}

async handleInhouseReturnSlip(event: Event, index: number) {
  const input = event.target as HTMLInputElement;
  if (input.files && input.files.length > 0) {
    const file = input.files[0];
    const url = await this.supabaseService.uploadFile(file, 'equipment-images');
    if (url) {
      this.inhouseEquipmentArray[index].return_slip = url;
    } else {
      console.error('❌ Failed to upload return slip.');
    }
  }
}

// Add this method to generate text for embedding
private generateEmbeddingText(equipment: any): string {
  // Generate comprehensive embedding text
  const generateContext = (equipment: any) => {
    const category = equipment.category?.toLowerCase() || '';
    const brand = equipment.brand?.toLowerCase() || '';
    const model = equipment.model?.toLowerCase() || '';
    const description = equipment.description?.toLowerCase() || '';

    // Get category-specific content
    const categoryDesc = this.categoryDescriptions[equipment.category] || '';
    const features = this.featuresByCategory[equipment.category] || [];
    const searchTerms = this.categorySearchTerms[equipment.category] || [];

    // Technical specifications extraction
    const specs = this.extractTechnicalSpecs(equipment);

    // Common industry terms
    const commonTerms = [
      'computer hardware',
      'pc components',
      'tech equipment',
      'computing device',
      equipment.category?.toLowerCase()
    ].join(' ');

    // Combine all relevant information
    const context = `
      ${brand} ${model} ${category}
      ${description}
      ${categoryDesc}
      ${features.join(' ')}
      ${searchTerms.join(' ')}
      ${specs}
      ${commonTerms}
      ${equipment.condition || ''}
      ${equipment.variety || ''}
    `;

    return context;
  };

  // Clean and normalize the text
  const embeddingText = generateContext(equipment)
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return embeddingText;
}

private extractTechnicalSpecs(equipment: any): string {
  const specs: string[] = [];

  // Extract numbers and units
  const numberPattern = /\d+(\.\d+)?\s*(gb|tb|mhz|ghz|mm|rpm|w|v)/gi;
  const matches = equipment.description?.match(numberPattern) || [];

  if (matches.length) {
    specs.push(...matches);
  }

  // Add common category-specific measurements
  if (equipment.category) {
    const categorySpecs: CategorySpecs = {
      'CPU': ['cores', 'threads', 'cache', 'socket'],
      'Memory': ['dimm', 'timing', 'latency', 'dual channel'],
      'Storage': ['capacity', 'read speed', 'write speed', 'cache'],
      'Video Card': ['vram', 'cuda cores', 'memory clock', 'core clock'],
      'Monitor': ['refresh rate', 'resolution', 'panel type', 'response time'],
      'Power Supply': ['wattage', 'efficiency', '80 plus', 'modular'],
      'CPU Cooler': ['fan size', 'noise level', 'heat pipes', 'tdp'],
      'Motherboard': ['socket type', 'form factor', 'chipset', 'memory slots'],
      'Case': ['form factor', 'dimensions', 'fan mounts', 'clearance'],
      'Operating System': ['version', 'architecture', 'edition', 'license'],
      'Peripherals - Mice': ['dpi', 'buttons', 'sensor type', 'polling rate'],
      'Peripherals - Keyboards': ['switch type', 'layout', 'key rollover', 'backlight'],
      'Peripherals - Headphones': ['driver size', 'impedance', 'frequency response', 'connectivity'],
      'Peripherals - Speakers': ['power output', 'frequency range', 'channels', 'connectivity'],
      'Peripherals - Webcams': ['resolution', 'frame rate', 'focus type', 'mic type'],
      'Expansion Cards / Networking - Sound Cards': ['channels', 'bit depth', 'sample rate', 'interface'],
      'Expansion Cards / Networking - Wired Network Adapters': ['speed', 'ports', 'interface', 'standards'],
      'Expansion Cards / Networking - Wireless Network Adapters': ['wifi standard', 'frequency bands', 'antenna', 'bluetooth'],
      'Accessories / Other': ['compatibility', 'connection type', 'power requirements', 'features']
    };

    const categorySpecList = categorySpecs[equipment.category] || [];
    specs.push(...categorySpecList);
  }

  return specs.join(' ');
}


// Add method to generate and store embedding
private async generateAndStoreEmbedding(equipmentId: string, equipment: any) {
  try {
    console.log('Generating embedding for:', equipment);

    if (!this.model) {
      await this.loadModel();
    }

    const textToEmbed = this.generateEmbeddingText(equipment);
    console.log('Text to embed:', textToEmbed);

    const embedding = await this.model.embed([textToEmbed]);
    const embeddingArray = await embedding.array();

    console.log('Generated embedding vector');

    const { error } = await this.supabaseService
      .from('equipment_embeddings')
      .insert({
        id: equipmentId,
        embedding: embeddingArray[0],
        metadata: {
          name: equipment.name,
          model: equipment.model,
          brand: equipment.brand,
          category: equipment.category
        }
      });

    if (error) throw error;
    console.log('Embedding stored successfully');

  } catch (error) {
    console.error('Error generating/storing embedding:', error);
    throw error;
  }
}

// Add method to load TensorFlow model
private async loadModel() {
  if (this.model || this.isModelLoading) return;

  this.isModelLoading = true;
  try {
    await tf.ready();
    this.model = await use.load();
    console.log('✅ TensorFlow model loaded');
  } catch (error) {
    console.error('❌ Failed to load TensorFlow model:', error);
  } finally {
    this.isModelLoading = false;
  }
}

async generateDescription(index: number): Promise<void> {
  const equipment = this.equipmentDataArray[index];

  if (!equipment.brand || !equipment.model || !equipment.category) {
    return;
  }

  const baseDescription = this.categoryDescriptions[equipment.category] || 'high-quality device';
  const features = this.featuresByCategory[equipment.category] || [];

  // Select 3 random features
  const selectedFeatures = features
    .sort(() => 0.5 - Math.random())
    .slice(0, 3);

  const description = `The ${equipment.brand} ${equipment.model} is a ${baseDescription}. ` +
    `This ${equipment.category.toLowerCase()} features ${selectedFeatures.join(', ')}. ` +
    `Manufactured by ${equipment.brand}, this ${equipment.category.toLowerCase()} ` +
    `offers reliable performance and quality construction for professional use.`;

  // Update the description
  equipment.description = description;

  // Force change detection
  this.cdRef.detectChanges();
}

async generateInhouseBarcode(equipment: InhouseEquipment) {
  if (!equipment.serial_number) {
    console.warn('No serial number provided');
    return;
  }

  try {
    const canvas = document.createElement('canvas');
    canvas.id = 'barcode-' + Date.now(); // Add unique ID

    // Use simpler configuration
    JsBarcode(canvas, equipment.serial_number);

    // Store the generated barcode
    equipment.barcode = canvas.toDataURL('image/png');

    console.log('✅ Barcode generated successfully for:', equipment.serial_number);
    this.cdRef.detectChanges();

  } catch (error) {
    console.error('❌ Error generating barcode:', error);
  }
}

async generatePropertyNumber(equipment: InhouseEquipment) {
  try {
    const year = new Date().getFullYear();
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');

    // Get the last property number from database
    const { data: lastEquipment, error } = await this.supabaseService
      .from('inhouse')
      .select('property_number')
      .order('property_number', { ascending: false })
      .limit(1);

    if (error) throw error;

    let sequence = 1;
    if (lastEquipment && lastEquipment[0]?.property_number) {
      const lastSequence = parseInt(lastEquipment[0].property_number.split('-')[2]);
      sequence = lastSequence + 1;
    }

    // Format: YYYY-MM-SEQUENCE
    equipment.property_number = `${year}-${month}-${sequence.toString().padStart(3, '0')}`;
    console.log('✅ Generated property number:', equipment.property_number);
    this.cdRef.detectChanges();

  } catch (error) {
    console.error('❌ Error generating property number:', error);
  }
}
}
