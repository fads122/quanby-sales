import { Component, OnInit, Inject, ChangeDetectorRef } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
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


interface InhouseEquipment {
  name: string;
  brand: string;
  model: string;
  quantity: number;
  serial_number: string;
  qr_code: string;
  barcode: string;
  images: string[];
  date_acquired: string;
  product_type: string;
  condition: string;
  damaged: boolean;
  repair_logs: any[];
  return_slip: string | File;
  inactive_reason?: string;  // New field
  inactive_location?: string; // New field
  ownership_type: 'government' | 'private';
}

interface CategoryContext {
  [key: string]: string;
}


@Component({
  selector: 'app-add-equipment',
  standalone: true,
  imports: [FormsModule, CommonModule, NgIf, MatDialogModule, MatIconModule, MatProgressSpinnerModule],
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
  brand: '',
  model: '',
  quantity: 1,
  serial_number: '',
  qr_code: '',
  barcode: '',
  images: [],
  date_acquired: new Date().toISOString().split('T')[0],
  product_type: 'operational_equipment',
  condition: '',
  damaged: false,
  repair_logs: [],
  return_slip: '',
  ownership_type: 'private'
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

  constructor(
    private supabaseService: SupabaseService,
    private router: Router,
    private cdRef: ChangeDetectorRef,
    public dialogRef: MatDialogRef<AddEquipmentComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any // Inject dialog data
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

  handleInhouseImageUpload(event: Event, index: number): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      const files = Array.from(input.files);
      this.inhouseEquipmentArray[index].images = files.map(file => URL.createObjectURL(file));
    }
  }

// Add method to remove in-house equipment form
removeInhouseEquipment(index: number) {
  this.inhouseEquipmentArray.splice(index, 1);
}

addInhouseEquipment() {
  this.inhouseEquipmentArray.push({
      name: '',
      brand: '',
      model: '',
      quantity: 1,
      serial_number: '',
      qr_code: '',
      barcode: '',
      images: [],
      date_acquired: new Date().toISOString().split('T')[0],
      product_type: 'operational_equipment',
      condition: '',
      damaged: false,
      repair_logs: [],
      return_slip: '',
      inactive_reason: '', // Initialize new field
      inactive_location: '', // Initialize new field
      ownership_type: 'private' // Add required property with default value
    });
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

  async onSubmit() {
    try {
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
        const imageInput = document.getElementById(`productImage${this.equipmentDataArray.indexOf(equipment)}`) as HTMLInputElement;
        if (imageInput && imageInput.files) {
          const imageUrls = await this.uploadImages(imageInput.files, 'equipment-images');
          equipment.product_images = imageUrls;
        }

        // Handle brochure upload if exists
        if (equipment.brochure) {
          const brochureUrl = await this.supabaseService.uploadFile(equipment.brochure, 'equipment-brochures');
          if (brochureUrl) {
            equipment.brochure_url = brochureUrl;
          }
        }

        // Handle update or add equipment
        if (this.isEditMode && this.equipmentId) {
          // Update existing equipment
          const updateResult = await this.supabaseService.updateEquipment(
            this.equipmentId,
            equipment,
            this.router
          );

          if (updateResult) {
            // Update embedding for the equipment
            await this.generateAndStoreEmbedding(this.equipmentId, equipment);

            // Close dialog and return updated data
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
          // Adding new equipment
          const result = await this.supabaseService.addEquipment(equipment);
          if (result) {
            // Generate and store embedding for new equipment
            await this.generateAndStoreEmbedding(result.id, equipment);

            // Storing initial cost entry
            const initialCostEntry = {
              supplier_cost: equipment.supplier_cost,
              srp: equipment.srp,
              date_updated: equipment.date_acquired
            };

            console.log("📌 Storing Initial Cost Entry:", initialCostEntry);
            await this.supabaseService.addCostHistory(result.id, initialCostEntry);

            // Handling expiry notifications if applicable
            if (equipment.item_type === 'Semi-Expendable') {
              console.log(`🔔 Checking for existing notifications before scheduling for ${equipment.name}...`);

              const expiryDate = new Date(equipment.date_acquired);
              expiryDate.setMonth(expiryDate.getMonth() + equipment.lifespan_months);
              const notificationStart = new Date(expiryDate);
              notificationStart.setMonth(notificationStart.getMonth() - 1);

              const alreadyScheduled = await this.supabaseService.checkExistingNotification(equipment.name, notificationStart);

              if (!alreadyScheduled) {
                console.log("✅ Scheduling notifications...");
                await this.scheduleExpiryNotifications(equipment);
              } else {
                console.log("⏳ Notification already scheduled for the final month. Skipping...");
              }
            }

            // Close dialog and return new equipment data
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
    }
  }

 async submitInhouseEquipment() {
  try {
    this.isSubmitting = true;

    for (const equipment of this.inhouseEquipmentArray) {
      if (!equipment.name || !equipment.serial_number) {
        alert('Please provide both Name and Serial Number for all equipment.');
        return;
      }

      // Validate inactive fields if condition is Inactive
      if (equipment.condition === 'Inactive' && (!equipment.inactive_reason || !equipment.inactive_location)) {
        alert('Please provide both reason and location for inactive equipment.');
        return;
      }

      // Generate UUID for each equipment
      const uuid = self.crypto.randomUUID();

      await this.generateQRCode(equipment);
      await this.generateBarcode(equipment);

      const imageInput = document.getElementById(`inhouseImageInput${this.inhouseEquipmentArray.indexOf(equipment)}`) as HTMLInputElement;
      let imageUrls: string[] = [];
      if (imageInput && imageInput.files) {
        imageUrls = await this.uploadImages(imageInput.files, 'equipment-images');
      }

      // Handle return slip upload if exists
      let returnSlipUrl = '';
      if (equipment.return_slip instanceof File) {
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
        serial_number: equipment.serial_number,
        qr_code: equipment.qr_code,
        barcode: equipment.barcode,
        images: imageUrls,
        date_acquired: equipment.date_acquired,
        product_type: equipment.product_type,
        status: equipment.condition === 'Inactive' ? 'inactive' : 'available',
        condition: equipment.condition,
        damaged: equipment.damaged,
        repair_logs: equipment.repair_logs,
        return_slip: returnSlipUrl,
        inactive_reason: equipment.condition === 'Inactive' ? equipment.inactive_reason : null,
        inactive_location: equipment.condition === 'Inactive' ? equipment.inactive_location : null
      };

      const { data, error } = await this.supabaseService
        .from('inhouse')
        .insert([equipmentData])
        .select();

      if (error) throw error;

      // Generate and store embedding for inhouse equipment
      if (data && data[0]) {
        await this.generateAndStoreEmbedding(data[0].id, equipmentData);
      }
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

  async generateBarcode(equipment: any) {
    const data = equipment.serial_no; // Use Serial No. as barcode data
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, data, { format: 'CODE128' });
      equipment.barcode = canvas.toDataURL(); // Store barcode as base64 image
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
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
  // Generate dynamic context based on equipment type and properties
  const generateDynamicContext = (equipment: any) => {
    const category = equipment.category?.toLowerCase() || '';
    const name = equipment.name?.toLowerCase() || '';
    const description = equipment.description?.toLowerCase() || '';

    // Extract key terms from category
    const categoryTerms = category.split(/[/-\s]+/).filter(Boolean);

    // Base context from equipment properties
    let context = `
      ${name} ${equipment.model || ''} ${equipment.brand || ''}
      ${description} ${category} ${equipment.variety || ''}
    `;

    // Add common terms for the category
    if (categoryTerms.length > 0) {
      context += ` ${categoryTerms.join(' ')} equipment device hardware component`;
    }

    // Add technical terms from description
    const technicalTerms = description.match(/\b\d+\s*[a-zA-Z]+\b/g) || []; // Match technical specs
    if (technicalTerms.length > 0) {
      context += ` ${technicalTerms.join(' ')}`;
    }

    return context;
  };

  const description = generateDynamicContext(equipment);
  return description.toLowerCase().trim().replace(/\s+/g, ' ');
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
}
