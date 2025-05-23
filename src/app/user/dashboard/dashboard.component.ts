
import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { SupabaseService } from '../../services/supabase.service';
import Chart from 'chart.js/auto';
import { CommonModule, NgIf, NgFor } from '@angular/common';
import { SidebarComponent } from '../../nav/sidebar/sidebar.component';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule } from '@angular/material/paginator';
import { NgModule } from '@angular/core';
import { ChartModule } from 'primeng/chart';
import { CardModule } from 'primeng/card';
import { DropdownModule } from 'primeng/dropdown';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { CalendarModule } from 'primeng/calendar';
import { AccordionModule } from 'primeng/accordion';
import { PaginatorModule } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';

interface TimeframeOption {
  label: string;
  value: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    NgFor,
    SidebarComponent,
    MatCardModule,
    MatSelectModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
    FormsModule,
    ChartModule,
    CardModule,
    DropdownModule,
    ButtonModule,
    InputTextModule,
    CalendarModule,
    AccordionModule,
    PaginatorModule,
    ToastModule
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit, AfterViewInit {

  userEmail: string | null = null;
  selectedEquipmentId: string | null = null;
  costHistory: any[] = [];
  equipmentList: any[] = [];
  costChart: Chart | null = null;
  totalEquipment: number = 0;
  recentActivities: any[] = [];
  paginatedActivities: any[] = [];
  currentPage: number = 0;
  pageSize: number = 3;
  totalPages: number = 0;
  borrowedEquipment: number = 0;
  totalSuppliers: number = 0;
  usedInProjects: number = 0;
  updatedEquipmentList: any[] = [];
  lowStockEquipment: any[] = [];
  lowStockCount: number = 0; // ✅ Declare the property
  totalPagesArray: (number | string)[] = [];
  filter = {
    startDate: '',
    endDate: '',
    message: ''
  };
  filteredActivities: any[] = [];
  selectedEquipmentSuppliers: {id: string, name: string}[] = [];
  selectedSuppliers: string[] = [];
  supplierColors: string[] = [];
  filteredCostHistory: any[] = [];

  selectedTimeframe = 'all';
  priceChangePercentage: number | null = null;
  currentAveragePrice: number | null = null;
  lowestPrice: number | null = null;
  highestPrice: number | null = null;
  currentPrice: number | null = null;
  lowestPriceDate: string | null = null;
  highestPriceDate: string | null = null;
  
  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef, private router: Router) {}

  async ngOnInit() {
    this.loadUserEmail();
    const rawEquipmentList = await this.supabaseService.getEquipmentList() || [];

    // Group equipment by model while preserving all individual records
    const equipmentGroups = new Map<string, any[]>();
    rawEquipmentList.forEach(item => {
        // Use model as the primary grouping key, fallback to name if model is empty
        const groupKey = item.model?.trim() || item.name?.trim() || 'uncategorized';

        if (!equipmentGroups.has(groupKey)) {
            equipmentGroups.set(groupKey, []);
        }
        equipmentGroups.get(groupKey)?.push(item);
    });

    // Create a grouped equipment list for the dropdown
    this.equipmentList = Array.from(equipmentGroups.entries()).map(([model, items]) => ({
        id: items[0].id, // Use first item's ID as the representative ID
        model: model,    // Store model instead of name
        name: items[0].name, // Keep name for backward compatibility if needed
        allItems: items  // Store all items for this equipment model
    }));

    // Sort equipment list alphabetically by model
    this.equipmentList.sort((a, b) => a.model.localeCompare(b.model));

    this.totalEquipment = rawEquipmentList.length; // Use actual count, not grouped count
    this.borrowedEquipment = await this.supabaseService.getBorrowedEquipmentCount();
    this.cdr.detectChanges();

    const suppliers = await this.supabaseService.getSuppliers();
    this.totalSuppliers = suppliers.length;
    this.usedInProjects = await this.supabaseService.getUsedInProjectsCount();

    // Fetch recent activities
    this.recentActivities = await this.supabaseService.getRecentActivities();

    // Sort activities by timestamp (newest first)
    this.recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Call the function to compute low-stock items
    this.computeLowStock();

    this.updatePagination();
}

  navigateTo(route: string) {
    this.router.navigate([route]);
  }

  getActivityTypeClass(type: string): string {
    switch (type) {
      case 'info': return 'info';
      case 'success': return 'success';
      case 'warning': return 'warning';
      case 'error': return 'error';
      default: return 'info';
    }
  }

  exportChartData() {
    // Implement export functionality (CSV, PNG, etc.)
    console.log('Exporting chart data...');
    // You can implement actual export logic here
    // For example, export as CSV:
    this.exportAsCSV();
  }

  private exportAsCSV() {
    if (!this.costHistory.length) return;

    const headers = ['Date', 'Supplier', 'Supplier Cost', 'SRP'];
    const csvRows = [];

    // Add headers
    csvRows.push(headers.join(','));

    // Add data rows
    this.costHistory.forEach(entry => {
      const row = [
        entry.date_updated,
        entry.supplier || 'N/A',
        entry.supplier_cost,
        entry.srp
      ];
      csvRows.push(row.join(','));
    });

    // Create CSV file
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);

    // Create download link
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', 'cost_history.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  getLatestSupplierPrice(supplierId: string): number | null {
    if (!this.costHistory.length) return null;
    const supplierName = this.selectedEquipmentSuppliers.find(s => s.id === supplierId)?.name;
    if (!supplierName) return null;

    const supplierEntries = this.costHistory
      .filter(entry => entry.supplier === supplierName)
      .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    return supplierEntries[0]?.supplier_cost || null;
  }

  getLatestSrpPrice(): number | null {
    if (!this.costHistory.length) return null;

    const sorted = [...this.costHistory].sort((a, b) =>
      new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());

    return sorted[0]?.srp || null;
  }

  changeTimeframe(timeframe: string) {
    this.selectedTimeframe = timeframe;
    // this.updateChartWithTimeframe();
  }


  calculateChartStats(data: any[]) {
    if (data.length === 0) {
      this.priceChangePercentage = null;
      this.currentAveragePrice = null;
      this.lowestPrice = null;
      this.highestPrice = null;
      this.currentPrice = null;
      this.lowestPriceDate = null;
      this.highestPriceDate = null;
      return;
    }

    // Sort chronologically
    const sortedData = [...data].sort((a, b) =>
      new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

    // Get first and last prices (using supplier cost)
    const firstPrice = sortedData[0].supplier_cost;
    const lastPrice = sortedData[sortedData.length - 1].supplier_cost;

    // Calculate percentage change
    this.priceChangePercentage = ((lastPrice - firstPrice) / firstPrice) * 100;

    // Calculate current average (average of last 3 entries)
    const lastThree = sortedData.slice(-3).map(entry => entry.supplier_cost);
    this.currentAveragePrice = lastThree.reduce((sum, price) => sum + price, 0) / lastThree.length;

    // Find lowest and highest prices
    const prices = sortedData.map(entry => entry.supplier_cost);
    this.lowestPrice = Math.min(...prices);
    this.highestPrice = Math.max(...prices);

    // Find dates for lowest and highest prices
    this.lowestPriceDate = sortedData.find(entry => entry.supplier_cost === this.lowestPrice)?.date_updated;
    this.highestPriceDate = sortedData.find(entry => entry.supplier_cost === this.highestPrice)?.date_updated;

    // Current price
    this.currentPrice = lastPrice;
  }

  getActivityIcon(type: string): string {
    switch (type) {
      case 'info': return 'fas fa-info-circle';
      case 'success': return 'fas fa-check-circle';
      case 'warning': return 'fas fa-exclamation-triangle';
      case 'error': return 'fas fa-times-circle';
      default: return 'fas fa-info-circle';
    }
  }

  onPageChange(event: any) {
    this.currentPage = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePagination();
  }

  applyActivityFilter() {
    const { startDate, endDate, message } = this.filter;
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    this.filteredActivities = this.recentActivities.filter(activity => {
      const activityDate = new Date(activity.timestamp);
      const messageMatch = message ? activity.message.toLowerCase().includes(message.toLowerCase()) : true;
      const startMatch = start ? activityDate >= start : true;
      const endMatch = end ? activityDate <= end : true;

      return messageMatch && startMatch && endMatch;
    });

    // Reset to first page after filtering
    this.currentPage = 0;

    this.updatePagination();
  }




  computeLowStock() {
    const groupedStock: { [key: string]: { model: string; stock: number } } = {};
    const lowStockThreshold = 3;

    // Group by model and sum quantities
    this.equipmentList.forEach(equipmentGroup => {
      equipmentGroup.allItems.forEach((item: any) => {
        const modelKey = item.model?.trim().toLowerCase() || 'uncategorized';

        if (!groupedStock[modelKey]) {
          groupedStock[modelKey] = {
            model: item.model || 'Unspecified Model',
            stock: 0
          };
        }

        groupedStock[modelKey].stock += Number(item.quantity) || 0;
      });
    });

    this.updatedEquipmentList = Object.values(groupedStock);
    this.lowStockEquipment = this.updatedEquipmentList.filter(item => item.stock < lowStockThreshold);
    this.lowStockCount = this.lowStockEquipment.length;
  }

  ngAfterViewInit() {
    this.initializeChart();
  }

  async loadUserEmail() {
    const user = await this.supabaseService.getUser();
    this.userEmail = user?.email || 'Guest';
  }

  async onEquipmentChange(event: any) {
    const selectedModel = event.target.value;
    this.costHistory = [];
    this.selectedEquipmentSuppliers = [];
    this.selectedSuppliers = [];

    if (selectedModel) {
      console.log(`🔄 Fetching cost history for Model: ${selectedModel}`);

      // Get all equipment with this model
      const { data: equipmentData, error: equipmentError } = await this.supabaseService
        .from('equipments')
        .select('*')
        .eq('model', selectedModel);

      if (equipmentError) {
        console.error('Error fetching equipment:', equipmentError);
        return;
      }

      if (!equipmentData || equipmentData.length === 0) {
        console.warn('No equipment found for model:', selectedModel);
        return;
      }

      // Get cost history for all equipment with this model
      let costData: any[] = [];
      for (const equipment of equipmentData) {
        const history = await this.supabaseService.getCostHistory(equipment.id);
        costData = [...costData, ...history];
      }

      console.log('📊 Raw Cost History from DB:', JSON.stringify(costData, null, 2));

      // Extract unique supplier names from cost history
      const supplierNames = [...new Set(costData.map(item => item.supplier).filter(Boolean))] as string[];

      // Map to supplier objects
      this.selectedEquipmentSuppliers = supplierNames.map(name => ({
        id: name,  // Using name as ID
        name: name
      }));

      // Generate color palette for suppliers
      this.generateColorPalette(this.selectedEquipmentSuppliers.length);

      // Normalize date format
      costData = costData.map(entry => ({
        ...entry,
        date_updated: new Date(entry.date_updated).toISOString().split('T')[0]
      }));

      console.log('📊 Normalized Cost History:', JSON.stringify(costData, null, 2));

      // For initial entry, use the first equipment in the group
      const firstEquipment = equipmentData[0];
      const { data: firstCostEntry, error: fetchError } = await this.supabaseService.getFirstCostEntry(firstEquipment.id);

      if (fetchError) {
        console.error("❌ Error fetching first cost entry:", fetchError);
      } else {
        console.log("🔍 First Recorded Cost Entry:", JSON.stringify(firstCostEntry, null, 2));
      }

      // Create initial entry if missing
      if (!firstCostEntry) {
        console.log("🆕 No initial cost entry found, inserting...");

        const initialEntry = {
          equipment_id: firstEquipment.id,
          supplier_cost: firstEquipment.supplier_cost,
          srp: firstEquipment.srp,
          date_updated: new Date(firstEquipment.date_acquired).toISOString().split('T')[0],
          entry_type: 'initial',
          supplier: firstEquipment.supplier || 'Unknown'
        };

        await this.supabaseService.addCostHistory(firstEquipment.id, initialEntry);
        costData.unshift(initialEntry);
        console.log('✅ Initial cost entry added.');
      }

      // Sort chronologically
      costData.sort((a, b) => new Date(a.date_updated).getTime() - new Date(b.date_updated).getTime());

      console.log('📊 Final Sorted Cost History:', JSON.stringify(costData, null, 2));

      // Update chart
      this.costHistory = costData;
      this.updateChart();
    }
  }

// Helper methods
private findSupplierId(supplierName: string, suppliers: any[]): string | null {
  if (!supplierName) return null;
  const found = suppliers.find(s => s.name === supplierName);
  return found ? found.id : null;
}

private getUniqueSuppliers(costData: any[], allSuppliers: any[]): {id: string, name: string}[] {
  const supplierIds = [...new Set(costData.map(item => item.supplier_id).filter(Boolean))];
  return allSuppliers.filter(s => supplierIds.includes(s.id));
}

private generateColorPalette(count: number): void {
  // Generate a dynamic color palette based on number of suppliers
  const hueStep = 360 / count;
  this.supplierColors = Array.from({length: count}, (_, i) => {
    const hue = i * hueStep;
    return `hsl(${hue}, 70%, 50%)`;
  });
}
// Add these methods to your DashboardComponent
toggleSupplierSelection(supplierId: string): void {
  if (this.selectedSuppliers.includes(supplierId)) {
    this.selectedSuppliers = this.selectedSuppliers.filter(id => id !== supplierId);
  } else {
    this.selectedSuppliers = [...this.selectedSuppliers, supplierId];
  }
  this.updateChart();
}

selectAllSuppliers(): void {
  this.selectedSuppliers = this.selectedEquipmentSuppliers.map(s => s.id);
  this.updateChart();
}

clearSupplierSelection(): void {
  this.selectedSuppliers = [];
  this.updateChart();
}

printRecentActivities() {
  const printWindow = window.open('', '', 'height=500,width=800');

  // Use recentActivities if no filter is applied
  const activitiesToPrint = this.filteredActivities.length ? this.filteredActivities : this.recentActivities;

  console.log(activitiesToPrint); // Debugging

  if (printWindow) {
    // Write initial HTML for the print window
    printWindow.document.write('<html><head><title>Recent Activities</title></head><body>');
    printWindow.document.write('<h2>Recent Activities</h2>');

    // Add activities to the print window
    activitiesToPrint.forEach(activity => {
      const formattedTimestamp = activity.timestamp ?
        new Date(activity.timestamp).toLocaleString('en-US', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
        }) : 'Unknown Time';

      printWindow.document.write(`
        <p><strong>Activity:</strong> ${activity.message}</p>
        <p><strong>Date:</strong> ${formattedTimestamp}</p>
        <hr>
      `);
    });

    // Close the document, allowing it to fully load
    printWindow.document.write('</body></html>');
    printWindow.document.close();

    // Delay the print action to ensure everything is rendered
    setTimeout(() => {
      printWindow.print();
    }, 500);
  } else {
    console.error('Failed to open print window');
  }
}

initializeChart() {
  const canvas = document.getElementById('costChart') as HTMLCanvasElement;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Removed the fixed canvas height setting (now handled in CSS)

  // Create gradient effects for better visualization
  const gradientSupplier = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSupplier.addColorStop(0, 'rgba(60, 40, 204, 0.5)');
  gradientSupplier.addColorStop(1, 'rgba(60, 40, 204, 0)');

  const gradientSRP = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSRP.addColorStop(0, 'rgba(218, 91, 150, 0.5)');
  gradientSRP.addColorStop(1, 'rgba(218, 91, 150, 0)');

  this.costChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Supplier Cost',
          data: [],
          borderColor: '#3C28CC',
          backgroundColor: gradientSupplier,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#3C28CC',
          pointRadius: 6,
          pointHoverRadius: 8,
          borderDash: [5, 5]
        },
        {
          label: 'Your Retail Price (SRP)', // Updated label for clarity
          data: [],
          borderColor: '#DA5B96',
          backgroundColor: gradientSRP,
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#DA5B96',
          pointRadius: 6,
          pointHoverRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              const value = Number(context.raw);
              return `₱${value.toLocaleString()}`;
            }
          }
        },
        legend: {
          display: true,
          labels: {
            color: '#333',
            font: {
              size: 14
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: false,
          grid: {
            color: 'rgba(200, 200, 200, 0.3)'
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
            }
          }
        },
        x: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

updateChart() {
  if (this.costChart) {
    this.costChart.destroy();
  }

  setTimeout(() => {
    const canvas = document.getElementById('costChart') as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx || !this.costHistory.length) {
      console.warn('⚠ No valid chart context or cost data found');
      return;
    }

    // Filter cost history based on selected suppliers
    const filteredCostHistory = this.selectedSuppliers.length > 0
      ? this.costHistory.filter(entry =>
          this.selectedSuppliers.includes(
            this.selectedEquipmentSuppliers.find(s => s.name === entry.supplier)?.id || ''
          )
        )
      : this.costHistory;

    // Format dates with month abbreviations for better readability
    const labels = filteredCostHistory.map((entry: any) => {
      const date = new Date(entry.date_updated);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    });

    const supplierCosts = filteredCostHistory.map((entry: any) => entry.supplier_cost);
    const srpCosts = filteredCostHistory.map((entry: any) => entry.srp);

    // Improved gradient effects
    const gradientSupplier = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSupplier.addColorStop(0, 'rgba(60, 40, 204, 0.3)');
    gradientSupplier.addColorStop(0.7, 'rgba(60, 40, 204, 0.1)');
    gradientSupplier.addColorStop(1, 'rgba(60, 40, 204, 0)');

    const gradientSRP = ctx.createLinearGradient(0, 0, 0, 400);
    gradientSRP.addColorStop(0, 'rgba(218, 91, 150, 0.3)');
    gradientSRP.addColorStop(0.7, 'rgba(218, 91, 150, 0.1)');
    gradientSRP.addColorStop(1, 'rgba(218, 91, 150, 0)');

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
                    currency: 'PHP'
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          },
          legend: {
            display: false
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
              drawTicks: false
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
            },
            border: {
              display: false
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
            },
            border: {
              display: false
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

    // Update the filtered cost history for display
    this.filteredCostHistory = filteredCostHistory;
  }, 100);
}


  // updatePagination() {
  //   this.totalPages = Math.ceil(this.recentActivities.length / this.pageSize);
  //   this.paginatedActivities = this.recentActivities.slice(this.currentPage * this.pageSize, (this.currentPage + 1) * this.pageSize);
  // }
  updatePagination() {
    const source = this.filteredActivities.length ? this.filteredActivities : this.recentActivities;

    // ✅ Sort by descending timestamp
    source.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    this.totalPages = Math.ceil(source.length / this.pageSize);

    // ✅ Ensure the current page never exceeds total pages
    if (this.currentPage >= this.totalPages) {
      this.currentPage = Math.max(0, this.totalPages - 1);
    }

    this.paginatedActivities = source.slice(
      this.currentPage * this.pageSize,
      (this.currentPage + 1) * this.pageSize
    );
  }


  // ✅ Go to Next Page
  nextPage() {
    if (this.currentPage < this.totalPages - 1) {
      this.currentPage++;
      this.updatePagination();
    }
  }

  // ✅ Go to Previous Page
  prevPage() {
    if (this.currentPage > 0) {
      this.currentPage--;
      this.updatePagination();
    }
  }

  // ✅ Jump to a Specific Page
  goToPage(page: number | "...") {
    if (typeof page === "number" && page >= 0 && page < this.totalPages) {
      this.currentPage = page;
      this.updatePagination();
    }
  }

}
