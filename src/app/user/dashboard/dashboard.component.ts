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
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType } from 'docx';


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
  
  isLoading: boolean = true;
  
  // Add new properties for sparkline data
  supplierSparkline: Chart | null = null;
  equipmentSparkline: Chart | null = null;
  borrowedSparkline: Chart | null = null;
  projectsSparkline: Chart | null = null;

  // Historical data arrays
  supplierHistory: number[] = [];
  equipmentHistory: number[] = [];
  borrowedHistory: number[] = [];
  projectsHistory: number[] = [];


  rankedSuppliers: any[] = [];
  topSupplierName: string = '';
  rankingFilter: string = 'overall';
  lastUpdated: Date = new Date();

  paginatedSuppliers: any[] = []; // Suppliers to display on current page
  itemsPerPage: number = 5;


  constructor(private supabaseService: SupabaseService, private cdr: ChangeDetectorRef, private router: Router) {}

  async ngOnInit() {
    try {
      this.isLoading = true;
      await this.loadUserEmail();
      const rawEquipmentList = await this.supabaseService.getEquipmentList() || [];

      // Group equipment by model while preserving all individual records
      const equipmentGroups = new Map<string, any[]>();
      rawEquipmentList.forEach(item => {
          const groupKey = item.model?.trim() || item.name?.trim() || 'uncategorized';

          if (!equipmentGroups.has(groupKey)) {
              equipmentGroups.set(groupKey, []);
          }
          equipmentGroups.get(groupKey)?.push(item);
      });

      this.equipmentList = Array.from(equipmentGroups.entries()).map(([model, items]) => ({
          id: items[0].id,
          model: model,
          name: items[0].name,
          allItems: items
      }));

      this.equipmentList.sort((a, b) => a.model.localeCompare(b.model));

      this.totalEquipment = rawEquipmentList.length;
      this.borrowedEquipment = await this.supabaseService.getBorrowedEquipmentCount();
      this.cdr.detectChanges();

      const suppliers = await this.supabaseService.getSuppliers();
      this.totalSuppliers = suppliers.length;
      this.usedInProjects = await this.supabaseService.getUsedInProjectsCount();

      this.recentActivities = await this.supabaseService.getRecentActivities();
      this.recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      this.computeLowStock();
      this.updatePagination();

      this.loadSupplierRanking();

      // Load historical data
      await this.loadHistoricalData();
      
      // Initialize sparkline charts
      this.initializeSparklines();

    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setTimeout(() => {
        this.isLoading = false;
      }, 1000); // Minimum 1 second loading time for better UX
    }
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
  const baseColors = [
    '#66BBDE', // Light blue
    '#4FA8D1', // Medium blue
    '#3B95C4', // Darker blue
    '#2982B7', // Deep blue
    '#1E6FA0', // Navy blue
  ];

  this.supplierColors = Array.from({ length: count }, (_, i) => {
    // If we have more suppliers than base colors, cycle through the base colors
    return baseColors[i % baseColors.length];
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

  // Create gradient effects for better visualization
  const gradientSupplier = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSupplier.addColorStop(0, 'rgba(102, 187, 222, 0.2)');  // Light blue
  gradientSupplier.addColorStop(1, 'rgba(102, 187, 222, 0.0)');

  const gradientSRP = ctx.createLinearGradient(0, 0, 0, 400);
  gradientSRP.addColorStop(0, 'rgba(183, 26, 74, 0.2)');  // Light red
  gradientSRP.addColorStop(1, 'rgba(183, 26, 74, 0.0)');

  this.costChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [
        {
          label: 'Supplier Cost',
          data: [],
          borderColor: '#66BBDE',
          backgroundColor: gradientSupplier,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#66BBDE',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#66BBDE',
          pointHoverBorderColor: '#FFFFFF'
        },
        {
          label: 'Your Retail Price (SRP)',
          data: [],
          borderColor: '#B71A4A',
          backgroundColor: gradientSRP,
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#B71A4A',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#B71A4A',
          pointHoverBorderColor: '#FFFFFF'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          titleColor: '#1a1a1a',
          titleFont: {
            size: 13,
            weight: 600,
            family: "'Inter', sans-serif"
          },
          bodyColor: '#666666',
          bodyFont: {
            size: 12,
            family: "'Inter', sans-serif"
          },
          padding: 12,
          boxPadding: 6,
          usePointStyle: true,
          borderColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 1,
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) {
                label += ': ';
              }
              if (context.parsed.y !== null) {
                label += new Intl.NumberFormat('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                  minimumFractionDigits: 2
                }).format(context.parsed.y);
              }
              return label;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          border: {
            display: false
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif",
              weight: 500
            },
            color: '#666666',
            maxRotation: 45,
            minRotation: 45,
            padding: 8
          }
        },
        y: {
          border: {
            display: false
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.06)',
            display: false,
            lineWidth: 1
          },
          ticks: {
            font: {
              size: 11,
              family: "'Inter', sans-serif",
              weight: 500
            },
            color: '#666666',
            padding: 8,
            callback: function(value) {
              return new Intl.NumberFormat('en-PH', {
                style: 'currency',
                currency: 'PHP',
                notation: 'compact',
                minimumFractionDigits: 0,
                maximumFractionDigits: 1
              }).format(value as number);
            }
          }
        }
      },
      animations: {
        tension: {
          duration: 1000,
          easing: 'easeInOutQuart',
          from: 0.8,
          to: 0.4,
          loop: false
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

    // Get all unique dates for consistent x-axis
    const allDates = [...new Set(this.costHistory.map(entry => entry.date_updated))].sort();

    // Create a map of all SRP values by date
    const srpByDate = new Map();
    this.costHistory.forEach(entry => {
      if (!srpByDate.has(entry.date_updated) || entry.srp > srpByDate.get(entry.date_updated)) {
        srpByDate.set(entry.date_updated, entry.srp);
      }
    });

    // Prepare datasets for each selected supplier
    const supplierDatasets = this.selectedSuppliers.length > 0 
      ? this.selectedSuppliers.map((supplierId, index) => {
          const supplier = this.selectedEquipmentSuppliers.find(s => s.id === supplierId);
          const supplierData = this.costHistory.filter(entry => 
            supplier && entry.supplier === supplier.name
          );
          
          // Create data points for this supplier
          const dataPoints = allDates.map(date => {
            const entry = supplierData.find(d => d.date_updated === date);
            return entry ? entry.supplier_cost : null;
          });

          // Create gradient for this supplier
          const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
          const color = this.supplierColors[index];
          gradient.addColorStop(0, `${color}33`); // 20% opacity
          gradient.addColorStop(1, `${color}00`); // 0% opacity

          return {
            label: supplier ? supplier.name : 'Unknown Supplier',
            data: dataPoints,
            borderColor: color,
            backgroundColor: gradient,
            borderWidth: 2,
            tension: 0.4,
            fill: true,
            pointBackgroundColor: color,
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
            pointHoverBorderWidth: 3,
            pointHoverBackgroundColor: color,
            pointHoverBorderColor: '#FFFFFF',
            spanGaps: true
          };
        })
      : [{
          label: 'Average Supplier Cost',
          data: allDates.map(date => {
            const entriesForDate = this.costHistory.filter(entry => entry.date_updated === date);
            if (entriesForDate.length === 0) return null;
            const totalCost = entriesForDate.reduce((sum, entry) => sum + entry.supplier_cost, 0);
            return totalCost / entriesForDate.length;
          }),
          borderColor: '#66BBDE',
          backgroundColor: (() => {
            const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
            gradient.addColorStop(0, 'rgba(102, 187, 222, 0.2)');
            gradient.addColorStop(1, 'rgba(102, 187, 222, 0.0)');
            return gradient;
          })(),
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#66BBDE',
          pointBorderColor: '#FFFFFF',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBorderWidth: 3,
          pointHoverBackgroundColor: '#66BBDE',
          pointHoverBorderColor: '#FFFFFF',
          spanGaps: true
        }];

    // Prepare SRP dataset
    const srpDataset = {
      label: 'Your Retail Price (SRP)',
      data: allDates.map(date => srpByDate.get(date) || null),
      borderColor: '#B71A4A',
      backgroundColor: (() => {
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, 'rgba(183, 26, 74, 0.2)');
        gradient.addColorStop(1, 'rgba(183, 26, 74, 0.0)');
        return gradient;
      })(),
      borderWidth: 2,
      tension: 0.4,
      fill: true,
      pointBackgroundColor: '#B71A4A',
      pointBorderColor: '#FFFFFF',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      pointHoverBorderWidth: 3,
      pointHoverBackgroundColor: '#B71A4A',
      pointHoverBorderColor: '#FFFFFF',
      spanGaps: true
    };

    // Format dates
    const labels = allDates.map(date => {
      return new Date(date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
      });
    });

    // Create the chart with all datasets
    this.costChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [...supplierDatasets, srpDataset]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            titleColor: '#1a1a1a',
            titleFont: {
              size: 13,
              weight: 600,
              family: "'Inter', sans-serif"
            },
            bodyColor: '#666666',
            bodyFont: {
              size: 12,
              family: "'Inter', sans-serif"
            },
            padding: 12,
            boxPadding: 6,
            usePointStyle: true,
            borderColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 1,
            callbacks: {
              label: function(context) {
                let label = context.dataset.label || '';
                if (label) {
                  label += ': ';
                }
                if (context.parsed.y !== null) {
                  label += new Intl.NumberFormat('en-PH', {
                    style: 'currency',
                    currency: 'PHP',
                    minimumFractionDigits: 2
                  }).format(context.parsed.y);
                }
                return label;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            border: {
              display: false
            },
            ticks: {
              font: {
                size: 11,
                family: "'Inter', sans-serif",
                weight: 500
              },
              color: '#666666',
              maxRotation: 45,
              minRotation: 45,
              padding: 8
            }
          },
          y: {
            border: {
              display: false
            },
            grid: {
              color: 'rgba(0, 0, 0, 0.06)',
              display: false,
              lineWidth: 1
            },
            ticks: {
              font: {
                size: 11,
                family: "'Inter', sans-serif",
                weight: 500
              },
              color: '#666666',
              padding: 8,
              callback: function(value) {
                return new Intl.NumberFormat('en-PH', {
                  style: 'currency',
                  currency: 'PHP',
                  notation: 'compact',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 1
                }).format(value as number);
              }
            }
          }
        },
        animations: {
          tension: {
            duration: 1000,
            easing: 'easeInOutQuart',
            from: 0.8,
            to: 0.4,
            loop: false
          }
        }
      }
    });

    // Update the filtered cost history for display
    this.filteredCostHistory = this.costHistory.filter(entry => 
      this.selectedSuppliers.length === 0 || 
      this.selectedSuppliers.includes(
        this.selectedEquipmentSuppliers.find(s => s.name === entry.supplier)?.id || ''
      )
    );
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

  async loadHistoricalData() {
    // Get last 7 days of data
    const today = new Date();
    const dates = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(today.getDate() - (6 - i));
      return date.toISOString().split('T')[0];
    });

    // Mock data for demonstration - replace with actual API calls
    this.supplierHistory = dates.map(() => Math.floor(Math.random() * 20) + 10);
    this.equipmentHistory = dates.map(() => Math.floor(Math.random() * 50) + 30);
    this.borrowedHistory = dates.map(() => Math.floor(Math.random() * 15) + 5);
    this.projectsHistory = dates.map(() => Math.floor(Math.random() * 25) + 15);
  }

  initializeSparklines() {
    this.createSparkline('supplierSparkline', this.supplierHistory, '#66BBDE');
    this.createSparkline('equipmentSparkline', this.equipmentHistory, '#A0143F');
    this.createSparkline('borrowedSparkline', this.borrowedHistory, '#B71A4A');
    this.createSparkline('projectsSparkline', this.projectsHistory, '#03045E');
  }

  createSparkline(canvasId: string, data: number[], color: string) {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Array(data.length).fill(''),
        datasets: [{
          data: data,
          backgroundColor: color,
          borderColor: color,
          borderWidth: 1,
          borderRadius: 2,
          barThickness: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            enabled: false
          }
        },
        scales: {
          x: {
            display: false,
            grid: {
              display: false
            }
          },
          y: {
            display: false,
            grid: {
              display: false
            },
            min: 0
          }
        },
        animation: {
          duration: 1000,
          easing: 'easeInOutQuart'
        }
      }
    });
  }


  async loadSupplierRanking() {
  try {
    // Fetch all suppliers and their products
    const { data: suppliers, error: supError } = await this.supabaseService
      .from('suppliers')
      .select('*');
    
    if (supError) throw supError;

    const { data: equipments, error: eqError } = await this.supabaseService
      .from('equipments')
      .select('id, supplier, supplier_cost, quantity, status');
    
    if (eqError) throw eqError;

    // Calculate scores for each supplier
    const ranked = suppliers.map(supplier => {
      const supplierProducts = equipments.filter(e => e.supplier === supplier.supplier_name);
      
      // Price score (lower average is better)
      const avgPrice = supplierProducts.reduce((sum, p) => sum + (p.supplier_cost || 0), 0) / 
                      (supplierProducts.length || 1);
      const priceScore = 10 - (avgPrice / 1000); // Adjust divisor based on your price range
      
      // Inventory score
      const totalStock = supplierProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
      const inventoryScore = Math.min(10, totalStock / 50); // Adjust divisor based on your stock levels
      
      // Reliability score (placeholder - you might need to track this separately)
      const reliabilityScore = 7 + Math.random() * 3; // Random for now
      
      // Overall score
      const overallScore = (priceScore * 0.4) + (inventoryScore * 0.3) + (reliabilityScore * 0.3);
      
      return {
        ...supplier,
        price_score: Math.min(10, Math.max(0, priceScore)),
        inventory_score: Math.min(10, Math.max(0, inventoryScore)),
        reliability_score: Math.min(10, Math.max(0, reliabilityScore)),
        overall_score: Math.min(10, Math.max(0, overallScore))
      };
    });

    // Sort by overall score
    this.rankedSuppliers = ranked.sort((a, b) => b.overall_score - a.overall_score);
    this.topSupplierName = this.rankedSuppliers[0]?.supplier_name || 'N/A';
    this.lastUpdated = new Date();
  } catch (error) {
    console.error('Error loading supplier ranking:', error);
  }
}

updateSupplierRanking() {
  switch(this.rankingFilter) {
    case 'price':
      this.rankedSuppliers.sort((a, b) => b.price_score - a.price_score);
      break;
    case 'inventory':
      this.rankedSuppliers.sort((a, b) => b.inventory_score - a.inventory_score);
      break;
    case 'reliability':
      this.rankedSuppliers.sort((a, b) => b.reliability_score - a.reliability_score);
      break;
    default:
      this.rankedSuppliers.sort((a, b) => b.overall_score - a.overall_score);
  }
}

viewSupplierDetails(supplierId: number) {
  this.router.navigate(['/supplier-profile', supplierId]);
}

scrollToRanking() {
  const element = document.getElementById('supplier-ranking');
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}


async exportRankingData() {
  try {
    // Create document content
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: "Supplier Ranking Report",
            heading: "Heading1",
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),
          new Paragraph({
            text: `Generated on ${new Date().toLocaleDateString()}`,
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          this.createRankingTable(),
          new Paragraph({
            text: "End of Report",
            alignment: AlignmentType.CENTER,
            spacing: { before: 400 },
          }),
        ],
      }],
    });

    // Generate the DOCX file
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `supplier_ranking_${new Date().toISOString().slice(0,10)}.docx`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Show success notification
    alert('Supplier ranking exported successfully as Word document');
  } catch (error) {
    console.error('Error exporting ranking data:', error);
    alert('Failed to export supplier ranking');
  }
}

private createRankingTable(): Table {
  // Table header
  const headerRow = new TableRow({
    children: [
      this.createHeaderCell("Rank"),
      this.createHeaderCell("Supplier"),
      this.createHeaderCell("Avg Price"),
      this.createHeaderCell("Inventory"),
      this.createHeaderCell("Reliability"),
      this.createHeaderCell("Overall"),
      this.createHeaderCell("Contact"),
      this.createHeaderCell("Phone"),
      this.createHeaderCell("Email"),
    ],
    tableHeader: true,
  });

  // Table rows with data
  const dataRows = this.rankedSuppliers.map((supplier, index) => {
    return new TableRow({
      children: [
        this.createDataCell((index + 1).toString()),
        this.createDataCell(supplier.supplier_name),
        this.createDataCell(supplier.price_score.toFixed(2)),
        this.createDataCell(supplier.inventory_score.toFixed(2)),
        this.createDataCell(supplier.reliability_score.toFixed(2)),
        this.createDataCell(supplier.overall_score.toFixed(2), true),
        this.createDataCell(supplier.contact_person || 'N/A'),
        this.createDataCell(supplier.phone || 'N/A'),
        this.createDataCell(supplier.email || 'N/A'),
      ],
    });
  });

  return new Table({
    rows: [headerRow, ...dataRows],
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
    columnWidths: [5, 15, 10, 10, 10, 10, 15, 10, 15],
  });
}

private createHeaderCell(text: string): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: true,
            color: "FFFFFF",
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: {
      fill: "4472C4", // Blue color
    },
  });
}

private createDataCell(text: string, highlight: boolean = false): TableCell {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text,
            bold: highlight,
            color: highlight ? "FF0000" : undefined,
          }),
        ],
        alignment: AlignmentType.CENTER,
      }),
    ],
    shading: highlight ? {
      fill: "FFFF00", // Yellow highlight
    } : undefined,
  });
}


}
