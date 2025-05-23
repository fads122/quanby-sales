import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import { ActivatedRoute, Router } from '@angular/router';
import Chart from 'chart.js/auto';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import * as bootstrap from 'bootstrap';
import { FormsModule } from '@angular/forms';

interface SupplierEditingState {
  supplier_cost?: boolean;
  srp?: boolean;
}

interface SupplierOriginalValues {
  supplier_cost?: number;
  srp?: number;
}

interface SupplierItem {
  supplier: string;
  supplier_cost: number;
  srp: number;
  editing?: SupplierEditingState;
  originalValues?: SupplierOriginalValues;
}

interface CostHistoryItem {
  date_updated: string;
  supplier_cost: number;
  srp: number;
  supplier?: string;
  entry_type?: string;
  equipment_id?: string;
}

interface EditingState {
  serial_no: boolean;
  date_acquired: boolean;
  lifespan_months: boolean;
  item_type: boolean;
  description: boolean;
  condition: boolean;
  supplier: boolean;
  supplier_cost: boolean;
  stocks_on_hand: boolean;
  srp: boolean;
  [key: string]: boolean;
}

interface EquipmentMovement {
  movement_date: string;
  movement_type: string;
  used_quantity: number;
  total_quantity: number;
  project_name: string;
  borrower_name: string;
}

interface EquipmentData {
  name: string;
  brand: string;
  model: string;
  serial_no: string;
  date_acquired: string;
  lifespan_months: number;
  condition: string;
  item_type?: string;
  supplier_cost: number;
  srp: number;
  supplier?: string;
  barcode?: string;
  product_images?: string[];
  description?: string;
  return_slip_url?: string;
  brochure_url?: string;
  repair_logs?: any[];
  cost_history?: CostHistoryItem[];
}

@Component({
  selector: 'app-equipment-details',
  standalone: true,
  imports: [CommonModule, SidebarComponent, FormsModule],
  templateUrl: './equipment-details.component.html',
  styleUrls: ['./equipment-details.component.css'],
})
export class EquipmentDetailsComponent implements OnInit {
  equipmentId: string | null = null;
  equipmentData: any = null;
  costChart: any;
  equipmentMovements: any[] = [];
  returnSlipUrl: SafeResourceUrl | null = null;
  originalReturnSlipUrl: string | null = null;
  private currentModal: any;
  brochureUrl: SafeResourceUrl | null = null;
  originalBrochureUrl: string | null = null;
  private brochureModalInstance: any;
  matchedSuppliers: any[] = [];
  selectedSupplier: string = 'All Suppliers';
  availableSuppliers: string[] = [];
  isSupplierFiltered: boolean = false;
  filteredCostHistory: any[] = [];
  originalValues: { [key: string]: any } = {};

  // New properties for operational equipment
  isOperationalEquipment: boolean = false;
  selectedQRCode: string | null = null;
  selectedBarcode: string | null = null;
  isQRCodeModalOpen: boolean = false;
  isBarcodeModalOpen: boolean = false;

  editing: EditingState = {
    serial_no: false,
    date_acquired: false,
    lifespan_months: false,
    item_type: false,
    description: false,
    condition: false,
    supplier: false,
    supplier_cost: false,
    srp: false,
    stocks_on_hand: false
  };

  constructor(
    private supabaseService: SupabaseService,
    private route: ActivatedRoute,
    private router: Router,
    private sanitizer: DomSanitizer
  ) {}

  async ngOnInit() {
    this.equipmentId = this.route.snapshot.paramMap.get('id');
    console.log('Equipment ID:', this.equipmentId);

    // Determine if this is operational equipment
    const navigation = this.router.getCurrentNavigation();
    this.isOperationalEquipment = navigation?.extras?.state?.['fromTable'] === 'inhouse';

    if (this.equipmentId) {
      await this.fetchEquipmentDetails(this.equipmentId);
      await this.fetchEquipmentMovements(this.equipmentId);

      // Always fetch suppliers by ID, regardless of name
      await this.fetchSuppliersForEquipment(this.equipmentId);

      // Fetch available suppliers from cost history
      await this.fetchAvailableSuppliers();
    }
  }

  // QR Code Methods
  openQRCodeModal(qrCodeUrl: string | null) {
    if (!qrCodeUrl) {
      console.warn("No QR Code available");
      return;
    }
    this.selectedQRCode = qrCodeUrl;
    this.isQRCodeModalOpen = true;
  }

  closeQRCodeModal() {
    this.isQRCodeModalOpen = false;
    this.selectedQRCode = null;
  }

  printQRCode() {
    if (!this.selectedQRCode) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print QR Code</title>
            <style>
              body { text-align: center; padding: 20px; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${this.selectedQRCode}" alt="QR Code">
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  // Barcode Methods
  openBarcodeModal(barcodeUrl: string | null) {
    if (!barcodeUrl) {
      console.warn("No Barcode available");
      return;
    }
    this.selectedBarcode = barcodeUrl;
    this.isBarcodeModalOpen = true;
  }

  closeBarcodeModal() {
    this.isBarcodeModalOpen = false;
    this.selectedBarcode = null;
  }

  printBarcode() {
    if (!this.selectedBarcode) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Barcode</title>
            <style>
              body { text-align: center; padding: 20px; }
              img { max-width: 100%; height: auto; }
            </style>
          </head>
          <body>
            <img src="${this.selectedBarcode}" alt="Barcode">
            <script>window.print();</script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }

  // Rest of your existing methods...
  async saveSupplierCost(supplier: SupplierItem, field: 'supplier_cost' | 'srp') {
    if (!supplier.editing?.[field] || supplier.originalValues?.[field] === undefined) {
      return;
    }

    try {
      const { error } = await this.supabaseService
        .from('equipments')
        .update({
          [field]: supplier[field],
          supplier: field === 'supplier_cost' ? supplier.supplier : this.equipmentData.supplier
        })
        .eq('id', this.equipmentId);

      if (error) throw error;

      this.equipmentData[field] = supplier[field];
      if (field === 'supplier_cost') {
        this.equipmentData.supplier = supplier.supplier;
      }

      await this.handleSupplierCostUpdate(supplier);

      if (supplier.editing) {
        supplier.editing[field] = false;
      }

      alert('Changes saved successfully!');
    } catch (err) {
      console.error('Error saving supplier cost:', err);
      if (supplier.originalValues) {
        supplier[field] = supplier.originalValues[field]!;
      }
      alert('Failed to save changes. Please try again.');
    }
  }

  async handleSupplierCostUpdate(supplier: SupplierItem) {
    if (!this.equipmentId) return;

    const newEntry = {
      equipment_id: this.equipmentId,
      supplier_cost: supplier.supplier_cost,
      srp: supplier.srp,
      date_updated: new Date().toISOString(),
      supplier: supplier.supplier,
      entry_type: 'supplier_update'
    };

    const { error } = await this.supabaseService
      .from('equipment_cost_history')
      .insert([newEntry]);

    if (error) {
      console.error('Error adding cost history:', error);
    } else {
      console.log('Supplier cost history updated successfully');
      await this.fetchEquipmentDetails(this.equipmentId);
      this.renderChart();
    }
  }

  startEditSupplierCost(supplier: SupplierItem, field: 'supplier_cost' | 'srp') {
    supplier.editing = {
      ...supplier.editing,
      [field]: true
    };
    supplier.originalValues = {
      ...supplier.originalValues,
      [field]: supplier[field]
    };
  }

  async onSupplierChange() {
    console.log('Selected supplier:', this.selectedSupplier);

    if (this.selectedSupplier === 'All Suppliers') {
      this.isSupplierFiltered = false;
      this.filteredCostHistory = this.equipmentData.cost_history || [];

      if (this.matchedSuppliers.length > 0) {
        this.matchedSuppliers.forEach(supplier => {
          if (!this.filteredCostHistory.some(item => item.supplier === supplier.supplier)) {
            this.filteredCostHistory.push({
              date_updated: this.equipmentData.date_acquired,
              supplier_cost: supplier.supplier_cost,
              srp: supplier.srp,
              supplier: supplier.supplier,
              entry_type: 'supplier_record'
            });
          }
        });
      }
    } else {
      this.isSupplierFiltered = true;
      this.filteredCostHistory = (this.equipmentData.cost_history || [])
        .filter((item: CostHistoryItem) => item.supplier?.toUpperCase() === this.selectedSupplier.toUpperCase());

      if (this.filteredCostHistory.length === 0) {
        const matched = this.matchedSuppliers.find(
          s => s.supplier?.toUpperCase() === this.selectedSupplier.toUpperCase()
        );

        if (matched) {
          this.filteredCostHistory = [{
            date_updated: this.equipmentData.date_acquired,
            supplier_cost: matched.supplier_cost,
            srp: matched.srp,
            supplier: matched.supplier,
            entry_type: 'supplier_record'
          }];
        }
      }
    }

    this.renderChart();
  }

  async fetchAvailableSuppliers() {
    const sources = [
      this.equipmentData?.supplier,
      ...(this.matchedSuppliers?.map(item => item.supplier) || []),
      ...((this.equipmentData?.cost_history || [])
        .map((item: CostHistoryItem) => item.supplier)
        .filter(Boolean))
    ];

    this.availableSuppliers = [
      'All Suppliers',
      ...new Set(
        sources
          .filter(Boolean)
          .map(s => s.toString().trim().toUpperCase())
      )
    ];

    console.log('Available suppliers:', this.availableSuppliers);
  }

  async fetchEquipmentMovements(equipmentId: string) {
    console.log(`Fetching movements for Equipment ID: ${equipmentId}`);

    try {
      const movements = await this.supabaseService.getEquipmentMovements(equipmentId);
      console.log('Raw movements data:', movements);

      if (!movements || movements.length === 0) {
        console.warn(`No movements found for equipment ID: ${equipmentId}`);
        this.equipmentMovements = [];
        return;
      }

      this.equipmentMovements = movements.map((movement: any) => ({
        movement_date: movement.movement_date || 'Unknown',
        movement_type: movement.movement_type || 'N/A',
        used_quantity: movement.used_quantity || 0,
        total_quantity: movement.borrowed_quantity || movement.total_quantity || 0,
        project_name: movement.project_name || 'N/A',
        borrower_name: movement.borrower_name || 'N/A',
      }));

      console.log('Processed movements:', this.equipmentMovements);
    } catch (error) {
      console.error('Error fetching movements:', error);
      this.equipmentMovements = [];
    }
  }

  async toggleEdit(field: string) {
    if (this.editing[field]) {
      try {
        const updateData: { [key: string]: any } = { [field]: this.equipmentData[field] };

        if (field === 'stocks_on_hand') {
          updateData['last_stock_update'] = new Date().toISOString();
        }

        if (field === 'date_acquired') {
          updateData[field] = new Date(updateData[field]).toISOString();
        }

        const { data, error } = await this.supabaseService
          .from('equipments')
          .update(updateData)
          .eq('id', this.equipmentId)
          .select();

        if (error) {
          console.error('Error updating equipment:', error);
          this.equipmentData[field] = this.originalValues[field];
          alert('Failed to update equipment. Please try again.');
        } else {
          console.log('Equipment updated successfully:', data);
          if (data && data[0]) {
            this.equipmentData = { ...this.equipmentData, ...data[0] };
          }

          if (field === 'supplier_cost' || field === 'srp' || field === 'supplier') {
            await this.handleCostUpdate();
          }

          alert('Changes saved successfully!');
        }
      } catch (err) {
        console.error('Error in toggleEdit:', err);
        this.equipmentData[field] = this.originalValues[field];
        alert('An error occurred while saving changes.');
      }
    } else {
      this.originalValues[field] = this.equipmentData[field];
    }

    this.editing[field] = !this.editing[field];
  }

  async handleCostUpdate() {
    if (!this.equipmentData || !this.equipmentId) return;

    const newEntry = {
      equipment_id: this.equipmentId,
      supplier_cost: this.equipmentData.supplier_cost,
      srp: this.equipmentData.srp,
      date_updated: new Date().toISOString(),
      supplier: this.equipmentData.supplier,
      entry_type: 'manual_update'
    };

    const { error } = await this.supabaseService
      .from('equipment_cost_history')
      .insert([newEntry]);

    if (error) {
      console.error('Error adding cost history:', error);
    } else {
      console.log('Cost history updated successfully');
      await this.fetchEquipmentDetails(this.equipmentId);
      this.renderChart();
    }
  }

  openModal(url: string, event: Event) {
    event.preventDefault();

    if (!url) {
      console.warn("Return Slip URL is missing or invalid!");
      return;
    }

    this.originalReturnSlipUrl = url;

    if (url.endsWith('.docx')) {
      url = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }

    console.log("Opening Return Slip (Converted URL):", url);

    this.returnSlipUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    const modalElement = document.getElementById('returnSlipModal');

    if (modalElement) {
      this.currentModal = new bootstrap.Modal(modalElement);
      this.currentModal.show();
    }
  }

  closeModal() {
    if (this.currentModal) {
      this.currentModal.hide();
      this.currentModal = null;
      this.returnSlipUrl = null;
    }
  }

  async fetchEquipmentDetails(equipmentId: string) {
    console.log(`Fetching equipment details for ID: ${equipmentId}`);

    if (!equipmentId || equipmentId === "NULL") {
      console.error("ERROR: Equipment ID is NULL in fetchEquipmentDetails!");
      return;
    }

    const data = this.isOperationalEquipment
      ? await this.supabaseService.getInHouseEquipmentById(equipmentId)
      : await this.supabaseService.getEquipmentById(equipmentId);

    console.log('Raw Equipment Data Retrieved:', data);

    if (!data) {
      console.error('Failed to fetch equipment details, redirecting...');
      this.router.navigate(['/equipment-list']);
      return;
    }

    this.equipmentData = data;

    if (!this.isOperationalEquipment) {
      let costData = await this.supabaseService.getCostHistory(equipmentId);
      console.log('Fetched Cost History Before Fix:', JSON.stringify(costData, null, 2));

      costData = costData.map(entry => ({
        ...entry,
        date_updated: new Date(entry.date_updated).toISOString().split('T')[0]
      }));

      console.log('Cost History After Normalizing Dates:', JSON.stringify(costData, null, 2));

      const { data: firstCostEntry, error: fetchError } = await this.supabaseService.getFirstCostEntry(equipmentId);

      if (fetchError) {
        console.error("Error fetching first cost entry:", fetchError);
      } else {
        console.log("First Recorded Cost Entry in DB:", JSON.stringify(firstCostEntry, null, 2));
      }

      if (!firstCostEntry) {
        console.log("No initial cost entry found, inserting it now...");

        const initialEntry = {
          equipment_id: equipmentId,
          supplier_cost: this.equipmentData.supplier_cost,
          srp: this.equipmentData.srp,
          date_updated: new Date(this.equipmentData.date_acquired).toISOString().split('T')[0],
          entry_type: 'initial',
          supplier: this.equipmentData.supplier || null
        };

        const insertedEntry = await this.supabaseService.addCostHistory(equipmentId, initialEntry);
        if (insertedEntry) {
          costData.unshift(insertedEntry[0]);
        } else {
          costData.unshift(initialEntry);
        }
        console.log('Initial cost entry added to history.');
      } else {
        console.log("Initial cost entry already exists in DB, skipping insertion.");
      }

      costData.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

      console.log('Final Sorted Cost History:', JSON.stringify(costData, null, 2));
      this.equipmentData.cost_history = costData;
      this.filteredCostHistory = [...costData];
    }

    await this.fetchAvailableSuppliers();

    if (this.equipmentData.brochure_url) {
      this.brochureUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.equipmentData.brochure_url);
      console.log('Brochure URL processed:', this.equipmentData.brochure_url);
    } else {
      console.warn('No brochure URL found.');
    }

    if (!this.equipmentData.barcode || this.equipmentData.barcode.trim() === '') {
      console.warn('Barcode not found, generating new barcode.');
      this.generateBarcode();
    }

    setTimeout(() => {
      if (!this.isOperationalEquipment) {
        this.renderChart();
      }
    }, 500);
  }

  async generateBarcode() {
    if (!this.equipmentData) return;

    try {
      const canvas = document.createElement('canvas');
      const JsBarcode = (await import('jsbarcode')).default;

      JsBarcode(canvas, this.equipmentData.serial_no || '0000000000', { format: 'CODE128' });

      this.equipmentData.barcode = canvas.toDataURL();
      console.log('Barcode generated successfully.');
    } catch (error) {
      console.error('Error generating barcode:', error);
    }
  }


  renderChart() {
    const canvas = document.getElementById('costChart') as HTMLCanvasElement;

    if (!canvas) {
      console.error('Canvas element not found!');
      return;
    }

    if (this.costChart) {
      this.costChart.destroy();
    }

    const costData = this.isSupplierFiltered ?
      this.filteredCostHistory :
      (this.equipmentData?.cost_history || []);

    if (!costData || costData.length === 0) {
      console.warn('No valid cost data found for chart.');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gradientSupplier = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSupplier.addColorStop(0, 'rgba(60, 40, 204, 0.3)');
    gradientSupplier.addColorStop(0.7, 'rgba(60, 40, 204, 0.1)');
    gradientSupplier.addColorStop(1, 'rgba(60, 40, 204, 0)');

    const gradientSRP = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSRP.addColorStop(0, 'rgba(218, 91, 150, 0.3)');
    gradientSRP.addColorStop(0.7, 'rgba(218, 91, 150, 0.1)');
    gradientSRP.addColorStop(1, 'rgba(218, 91, 150, 0)');

    const labels = costData.map((entry: { date_updated: string }) => {
      const date = new Date(entry.date_updated);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    });

    const supplierCosts = costData.map((entry: { supplier_cost: number }) => entry.supplier_cost);
    const srpCosts = costData.map((entry: { srp: number }) => entry.srp);

    const chartTitle = this.isSupplierFiltered
      ? `Cost History (${this.selectedSupplier})`
      : 'Cost History (All Suppliers)';

    this.costChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Supplier Cost',
            data: supplierCosts,
            borderColor: '#3C28CC',
            backgroundColor: gradientSupplier,
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#3C28CC',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2
          },
          {
            label: 'SRP',
            data: srpCosts,
            borderColor: '#DA5B96',
            backgroundColor: gradientSRP,
            borderWidth: 2.5,
            tension: 0.3,
            fill: true,
            pointBackgroundColor: '#DA5B96',
            pointBorderColor: '#fff',
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: { size: 14, weight: 'bold' },
            bodyFont: { size: 13 },
            padding: 12,
            displayColors: true,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD'
                  }).format(context.parsed.y);
                }
                return label;
              },
              afterLabel: (context) => {
                const dataIndex = context.dataIndex;
                const entry = costData[dataIndex];
                let tooltip = '';
                if (entry.supplier) tooltip += `Supplier: ${entry.supplier}\n`;
                if (entry.entry_type === 'supplier_record') tooltip += '(From supplier record)';
                return tooltip;
              }
            }
          },
          legend: {
            display: false
          },
          title: {
            display: true,
            text: chartTitle,
            font: {
              size: 16,
              weight: 'bold'
            },
            padding: {
              top: 10,
              bottom: 20
            }
          }
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        scales: {
          y: {
            beginAtZero: false,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)',
              // drawBorder: false // Optionally, you can use drawBorder if supported
            },
            ticks: {
              font: {
                size: 12
              },
              callback: function(value) {
                const numericValue = Number(value);
                if (numericValue >= 1_000_000) return `₱${(numericValue / 1_000_000).toFixed(1)}M`;
                if (numericValue >= 1_000) return `₱${(numericValue / 1_000).toFixed(1)}K`;
                return `₱${numericValue}`;
              },
              padding: 10
            }
          },
          x: {
            grid: {
              display: false
            },
            ticks: {
              font: {
                size: 12
              },
              padding: 10
            }
          }
        },
        elements: {
          line: {
            cubicInterpolationMode: 'monotone'
          }
        }
      }
    });
  }

  openBrochureModal(url: string, event: Event) {
    event.preventDefault();

    if (!url) {
      console.warn("Brochure URL is missing or invalid!");
      return;
    }

    this.originalBrochureUrl = url;

    if (url.endsWith('.pdf') || url.endsWith('.docx')) {
      url = `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
    }

    console.log("Opening Brochure (Converted URL):", url);

    this.brochureUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);

    const modalElement = document.getElementById('brochureModal');
    if (modalElement) {
      this.brochureModalInstance = new bootstrap.Modal(modalElement);
      this.brochureModalInstance.show();
    }
  }

  closeBrochureModal() {
    if (this.brochureModalInstance) {
      this.brochureModalInstance.hide();
      this.brochureModalInstance = null;
      this.brochureUrl = null;
    }
  }

  goBack() {
    this.router.navigate(['/equipment-list']);
  }

  async fetchSuppliersForEquipment(equipmentId: string) {
    try {
      console.log(`Fetching suppliers for equipment ID: ${equipmentId}`);

      if (this.isOperationalEquipment) {
        this.matchedSuppliers = [];
        return;
      }

      const currentSupplier = {
        supplier: this.equipmentData.supplier,
        supplier_cost: this.equipmentData.supplier_cost,
        srp: this.equipmentData.srp,
        editing: {},
        originalValues: {}
      };

      const { data, error } = await this.supabaseService
        .from('equipments')
        .select('supplier, supplier_cost, srp')
        .eq('model', this.equipmentData.model)
        .neq('id', equipmentId);

      if (error) throw error;

      this.matchedSuppliers = [currentSupplier];
      if (data && data.length > 0) {
        this.matchedSuppliers.push(...data.map(s => ({
          ...s,
          editing: {},
          originalValues: {}
        })));
      }

      console.log('Fetched suppliers:', this.matchedSuppliers);
      await this.fetchAvailableSuppliers();
    } catch (err) {
      console.error('Error in fetching suppliers:', err);
      this.matchedSuppliers = [];
    }
  }

  calculateMargin(srp: number, cost: number): number {
    if (!cost || cost <= 0) return 0;
    const margin = ((srp - cost) / cost) * 100;
    return Math.round(margin * 100) / 100;
  }

  getMarginClass(srp: number, cost: number): string {
    const margin = this.calculateMargin(srp, cost);

    if (margin > 30) return 'high';
    if (margin > 15) return 'medium';
    return 'low';
  }

   getStatusClass(status: string): string {
    if (!status) return 'secondary';
    const statusLower = status.toLowerCase();
    if (statusLower.includes('available')) return 'success';
    if (statusLower.includes('in use') || statusLower.includes('assigned')) return 'primary';
    if (statusLower.includes('maintenance') || statusLower.includes('repair')) return 'warning';
    if (statusLower.includes('damaged') || statusLower.includes('retired')) return 'danger';
    return 'secondary';
  }

  getConditionClass(condition: string): string {
    if (!condition) return 'secondary';
    const conditionLower = condition.toLowerCase();
    if (conditionLower.includes('excellent') || conditionLower.includes('good')) return 'success';
    if (conditionLower.includes('fair')) return 'warning';
    if (conditionLower.includes('poor') || conditionLower.includes('bad')) return 'danger';
    return 'secondary';
  }

}