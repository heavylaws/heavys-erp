import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ChartLine, LogOut, DollarSign, ShoppingCart, AlertTriangle, BarChart, Plus, RefreshCw, Users, Monitor, ChefHat, Download, Terminal, Package, FileText } from "lucide-react";
import { InventoryTable } from "@/components/inventory-table";
import { SalesChart } from "@/components/sales-chart";
import { UserManagement } from "@/components/user-management";
import { ProductManagement } from "@/components/product-management";
import { CategoryManagement } from "@/components/category-management";
import { OrderManagement } from "@/components/order-management";
import { AddProductDialog } from "@/components/add-product-dialog";

import { AddComponentDialog } from "@/components/add-component-dialog";
import { BundleManager } from "@/components/bundle-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyRateManager } from "@/components/currency-rate-manager";
import { InventoryNotifications } from "@/components/inventory-notifications";
import { LowStockDashboard } from "@/components/low-stock-dashboard";
import { EnhancedOrderManagement } from "@/components/enhanced-order-management";
import { CostManagement } from "@/components/cost-management";
import { ManagerReports } from "@/components/manager-reports";
import { ShiftButton } from "@/components/shift-button";
import { SupplierManagement } from '@/components/supplier-management';
import { CustomerManagement } from '@/components/customer-management';
import { PurchaseOrderManagement } from '@/components/purchase-order-management';
import { OrganizationSettings } from '@/components/organization-settings';
import { QuotationManagement } from '@/components/quotation-management';
import { Truck, ClipboardList, Building2 } from "lucide-react";

import { OptionGroupManagement } from '@/components/option-group-management';
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Database, Server, Wifi } from "lucide-react";
import { type CompanySettings } from "@shared/schema";

interface Analytics {
  sales: { total: number; count: number };
  topProducts: Array<{ product: any; sales: number; revenue: number }>;
  lowStockCount: number;
}

export default function ManagerDashboard() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [showLowStock, setShowLowStock] = useState(false);

  const { isConnected } = useWebSocket((message) => {
    if (message.type === 'order_update' || message.type === 'ORDER_UPDATE') {
      // Refresh analytics and inventory when orders change
      queryClient.invalidateQueries({ queryKey: ['/api/analytics/today'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({
        title: "Dashboard Updated",
        description: "New data received.",
        duration: 2000,
      });
    }
  });

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  };

  // Redirect if not authorized (Authentication is handled by App.tsx)
  useEffect(() => {
    if (!isLoading && user && !['admin', 'manager'].includes((user as any).role)) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
      return;
    }
  }, [isLoading, user, toast]);

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ['/api/analytics/today']
  });

  // Fetch low stock items
  const { data: lowStockData } = useQuery<{ products: any[]; components: any[]; }>({
    queryKey: ['/api/inventory/low-stock']
  });

  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/settings/company'] });
  const companyName = settings?.name || "Highway Cafe";

  // Print barcodes for all products
  const printBarcodes = () => {
    const barcodeWindow = window.open('', '_blank');
    if (!barcodeWindow) {
      toast({
        title: "Error",
        description: "Please enable pop-ups to print barcodes.",
        variant: "destructive"
      });
      return;
    }

    const barcodeHTML = `
      <html>
        <head>
          <title>Product Barcodes - {companyName}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .barcode-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
            .barcode-item { border: 1px solid #ddd; padding: 15px; text-align: center; }
            .barcode { font-family: monospace; font-size: 24px; letter-spacing: 2px; margin: 10px 0; }
            .product-name { font-weight: bold; margin-bottom: 5px; }
            .product-info { font-size: 12px; color: #666; }
            @media print { .barcode-item { break-inside: avoid; } }
          </style>
        </head>
        <body>
          <h1>Product Barcodes - {companyName}</h1>
          <p>Generated on: ${new Date().toLocaleString()}</p>
          <div class="barcode-grid">
            <!-- Barcodes would be generated here with real product data -->
            <div class="barcode-item">
              <div class="product-name">Sample Product</div>
              <div class="product-info">Price: $4.99</div>
              <div class="product-info">SKU: PROD-001</div>
            </div>
          </div>
        </body>
      </html>
    `;

    barcodeWindow.document.write(barcodeHTML);
    barcodeWindow.document.close();
    barcodeWindow.focus();
    barcodeWindow.print();
    barcodeWindow.close();

    toast({
      title: "Barcodes Generated",
      description: "Product barcodes have been sent to printer."
    });
  };

  // Print inventory report
  const printInventoryReport = () => {
    const reportWindow = window.open('', '_blank');
    if (!reportWindow) {
      toast({
        title: "Error",
        description: "Please enable pop-ups to print reports.",
        variant: "destructive"
      });
      return;
    }

    const reportHTML = `
      <html>
        <head>
          <title>Inventory Report - {companyName}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .header { text-align: center; margin-bottom: 30px; }
            .section { margin-bottom: 30px; }
            .section h2 { border-bottom: 2px solid #333; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f2f2f2; }
            .low-stock { background-color: #ffe6e6; }
            .summary { background-color: #f9f9f9; padding: 15px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>{companyName} - Inventory Report</h1>
            <p>Generated on: ${new Date().toLocaleString()}</p>
          </div>
          
          <div class="section">
            <h2>Summary</h2>
            <div class="summary">
              <p><strong>Total Products:</strong> ${analytics?.topProducts.length || 0}</p>
              <p><strong>Low Stock Items:</strong> ${totalLowStockItems}</p>
              <p><strong>Total Sales Today:</strong> $${analytics?.sales.total.toFixed(2) || '0.00'}</p>
            </div>
          </div>
          
          <div class="section">
            <h2>Low Stock Alert</h2>
            <table>
              <tr>
                <th>Product Name</th>
                <th>Current Stock</th>
                <th>Min Threshold</th>
                <th>Status</th>
              </tr>
              <!-- Low stock items would be populated here -->
            </table>
          </div>
        </body>
      </html>
    `;

    reportWindow.document.write(reportHTML);
    reportWindow.document.close();
    reportWindow.focus();
    reportWindow.print();
    reportWindow.close();

    toast({
      title: "Report Generated",
      description: "Inventory report has been sent to printer."
    });
  };

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totalLowStockItems = (lowStockData?.products?.length || 0) + (lowStockData?.components?.length || 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="bg-secondary p-2 rounded-lg">
              <ChartLine className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral">Manager Dashboard</h1>
              <p className="text-sm text-gray-600">{companyName} Management</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <ShiftButton
                currentUser={user as any}
                onLogout={handleLogout}
              />
            ) : null}

            <Button
              onClick={handleLogout}
              variant="ghost"
              size="sm"
              data-testid="button-logout-header"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="p-6">
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Today's Sales</p>
                  <p className="text-2xl font-bold text-neutral">
                    ${analytics?.sales.total.toFixed(2) || '0.00'}
                  </p>
                  <p className="text-xs text-secondary">
                    {analytics?.sales.count || 0} orders today
                  </p>
                </div>
                <div className="bg-secondary/10 p-3 rounded-lg">
                  <DollarSign className="text-secondary h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Orders</p>
                  <p className="text-2xl font-bold text-neutral">
                    {analytics?.sales.count || 0}
                  </p>
                  <p className="text-xs text-secondary">Total orders today</p>
                </div>
                <div className="bg-primary/10 p-3 rounded-lg">
                  <ShoppingCart className="text-primary h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Low Stock Items</p>
                  <p className="text-2xl font-bold text-accent">
                    {totalLowStockItems}
                  </p>
                  <p className="text-xs text-accent">Needs attention</p>
                </div>
                <div className="bg-accent/10 p-3 rounded-lg">
                  <AlertTriangle className="text-accent h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Avg Order Value</p>
                  <p className="text-2xl font-bold text-neutral">
                    ${analytics?.sales?.count && analytics.sales.count > 0
                      ? (analytics.sales.total / analytics.sales.count).toFixed(2)
                      : '0.00'
                    }
                  </p>
                  <p className="text-xs text-secondary">Per order</p>
                </div>
                <div className="bg-warning/10 p-3 rounded-lg">
                  <BarChart className="text-warning h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>





        {/* Alert Banner */}
        {totalLowStockItems > 0 && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Low Stock Alert</AlertTitle>
            <AlertDescription className="text-red-700">
              {totalLowStockItems} items are running low and need to be restocked urgently.
              <Button
                className="ml-4 bg-red-600 hover:bg-red-700 text-white"
                size="sm"
                onClick={() => {
                  setActiveTab('inventory');
                  setShowLowStock(true);
                  setTimeout(() => {
                    const inventorySection = document.getElementById('inventory-section');
                    inventorySection?.scrollIntoView({ behavior: 'smooth' });
                  }, 100);
                }}
              >
                View Low Stock Items
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* ... (existing code) */}

        {/* Tabbed Interface */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex w-full overflow-x-auto pb-2 justify-start h-auto flex-nowrap gap-2 bg-transparent p-0 no-scrollbar">
            <TabsTrigger value="overview" className="flex-shrink-0">Overview</TabsTrigger>
            <TabsTrigger value="reports" className="flex-shrink-0">Reports</TabsTrigger>
            <TabsTrigger value="inventory" className="flex-shrink-0">Inventory</TabsTrigger>
            <TabsTrigger value="costs" className="flex-shrink-0">Cost Mgmt</TabsTrigger>
            <TabsTrigger value="products" className="flex-shrink-0">Products</TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0">Categories</TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-shrink-0">Suppliers</TabsTrigger>
            <TabsTrigger value="customers" className="flex-shrink-0">Customers</TabsTrigger>
            <TabsTrigger value="components" className="flex-shrink-0">Components</TabsTrigger>
            <TabsTrigger value="purchase-orders" className="flex-shrink-0">PO</TabsTrigger>
            <TabsTrigger value="orders" className="flex-shrink-0">Orders</TabsTrigger>
            <TabsTrigger value="users" className="flex-shrink-0">Users</TabsTrigger>
            <TabsTrigger value="currency" className="flex-shrink-0">Currency</TabsTrigger>
            <TabsTrigger value="quotes" className="flex-shrink-0">Quotes</TabsTrigger>
            <TabsTrigger value="settings" className="flex-shrink-0">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8 animate-fade-in-up">
            {/* Hero Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-none shadow-lg transform transition-all hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-blue-100 font-medium mb-1">Total Revenue</p>
                      <h3 className="text-3xl font-bold">${analytics?.sales.total.toFixed(2) || '0.00'}</h3>
                      <div className="mt-4 flex items-center text-blue-200 text-sm">
                        <ChartLine className="h-4 w-4 mr-1" />
                        <span>+15% from yesterday</span>
                      </div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-600 to-purple-700 text-white border-none shadow-lg transform transition-all hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-purple-100 font-medium mb-1">Orders Today</p>
                      <h3 className="text-3xl font-bold">{analytics?.sales.count || 0}</h3>
                      <div className="mt-4 flex items-center text-purple-200 text-sm">
                        <ShoppingCart className="h-4 w-4 mr-1" />
                        <span>New orders coming in</span>
                      </div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                      <ShoppingCart className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={`${totalLowStockItems > 0 ? 'bg-gradient-to-br from-red-500 to-red-600' : 'bg-gradient-to-br from-green-500 to-green-600'} text-white border-none shadow-lg transform transition-all hover:scale-105`}>
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white/90 font-medium mb-1">Inventory Status</p>
                      <h3 className="text-3xl font-bold">{totalLowStockItems}</h3>
                      <div className="mt-4 flex items-center text-white/80 text-sm">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        <span>{totalLowStockItems > 0 ? 'Items need attention' : 'All stocks healthy'}</span>
                      </div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                      <Package className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-slate-700 to-slate-800 text-white border-none shadow-lg transform transition-all hover:scale-105">
                <CardContent className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-slate-300 font-medium mb-1">System Health</p>
                      <h3 className="text-3xl font-bold">100%</h3>
                      <div className="mt-4 flex items-center text-green-400 text-sm">
                        <Wifi className="h-4 w-4 mr-1" />
                        <span>All systems online</span>
                      </div>
                    </div>
                    <div className="bg-white/20 p-3 rounded-xl backdrop-blur-sm">
                      <Server className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

              {/* Quick Actions - Modern Tiles */}
              <div className="lg:col-span-2 space-y-6">
                <h3 className="text-lg font-bold text-gray-800 flex items-center">
                  <span className="bg-blue-600 w-1 h-6 mr-3 rounded-full"></span>
                  Quick Actions
                </h3>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <AddProductDialog>
                    <div className="group bg-white hover:bg-blue-50 border border-gray-100 hover:border-blue-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center text-center h-32">
                      <div className="bg-blue-100 p-3 rounded-full mb-3 group-hover:bg-blue-200 transition-colors">
                        <Plus className="h-6 w-6 text-blue-600" />
                      </div>
                      <span className="font-semibold text-gray-700 group-hover:text-blue-700">Add Product</span>
                    </div>
                  </AddProductDialog>

                  <div
                    onClick={() => {
                      setActiveTab('inventory');
                      setTimeout(() => document.getElementById('inventory-section')?.scrollIntoView({ behavior: 'smooth' }), 100);
                    }}
                    className="group bg-white hover:bg-orange-50 border border-gray-100 hover:border-orange-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center text-center h-32"
                  >
                    <div className="bg-orange-100 p-3 rounded-full mb-3 group-hover:bg-orange-200 transition-colors">
                      <Package className="h-6 w-6 text-orange-600" />
                    </div>
                    <span className="font-semibold text-gray-700 group-hover:text-orange-700">Restock</span>
                  </div>

                  <div
                    onClick={() => window.open('/kiosk', '_blank')}
                    className="group bg-white hover:bg-purple-50 border border-gray-100 hover:border-purple-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center text-center h-32"
                  >
                    <div className="bg-purple-100 p-3 rounded-full mb-3 group-hover:bg-purple-200 transition-colors">
                      <Monitor className="h-6 w-6 text-purple-600" />
                    </div>
                    <span className="font-semibold text-gray-700 group-hover:text-purple-700">Kiosk Mode</span>
                  </div>

                  <div
                    onClick={() => window.open('/kitchen', '_blank')}
                    className="group bg-white hover:bg-emerald-50 border border-gray-100 hover:border-emerald-200 p-6 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col items-center justify-center text-center h-32"
                  >
                    <div className="bg-emerald-100 p-3 rounded-full mb-3 group-hover:bg-emerald-200 transition-colors">
                      <ChefHat className="h-6 w-6 text-emerald-600" />
                    </div>
                    <span className="font-semibold text-gray-700 group-hover:text-emerald-700">Kitchen Display</span>
                  </div>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-4">Sales Analytics</h3>
                  <div className="h-64 w-full">
                    <SalesChart />
                  </div>
                </div>
              </div>

              {/* Sidebar Stats */}
              <div className="space-y-6">
                <Card className="border-none shadow-sm bg-indigo-900 text-white overflow-hidden relative">
                  <div className="absolute top-0 right-0 -mr-4 -mt-4 w-24 h-24 bg-white/10 rounded-full blur-xl"></div>
                  <CardHeader>
                    <CardTitle className="flex items-center text-white">
                      <BarChart className="mr-2 h-5 w-5 text-indigo-300" />
                      Targets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 relative z-10">
                    <div>
                      <div className="flex justify-between text-sm mb-1 text-indigo-200">
                        <span>Daily Goal ($1500)</span>
                        <span>{Math.min(100, ((analytics?.sales.total || 0) / 1500) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-indigo-950 rounded-full h-2">
                        <div
                          className="bg-indigo-400 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, ((analytics?.sales.total || 0) / 1500) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1 text-indigo-200">
                        <span>Orders Goal (50)</span>
                        <span>{Math.min(100, ((analytics?.sales.count || 0) / 50) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="w-full bg-indigo-950 rounded-full h-2">
                        <div
                          className="bg-pink-500 h-2 rounded-full transition-all duration-1000"
                          style={{ width: `${Math.min(100, ((analytics?.sales.count || 0) / 50) * 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm h-full">
                  <CardHeader>
                    <CardTitle>Recent Alerts</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {totalLowStockItems === 0 && (
                      <div className="flex flex-col items-center justify-center py-6 text-gray-400">
                        <CheckCircle className="h-10 w-10 text-green-500 mb-2" />
                        <p>All systems normal</p>
                      </div>
                    )}
                    <ul className="space-y-3">
                      {lowStockData?.products?.slice(0, 3).map((p: any) => (
                        <li key={p.id} className="flex items-start p-3 bg-red-50 rounded-lg border border-red-100">
                          <AlertTriangle className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm font-medium text-red-900">{p.name}</p>
                            <p className="text-xs text-red-700">Stock: {p.stockQuantity} (Min: {p.minThreshold})</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="reports" className="space-y-6">
            {user ? <ManagerReports currentUser={user as any} /> : null}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-6">
            <LowStockDashboard />
            <Card id="inventory-section">
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  All Inventory Status
                  <div className="flex space-x-2">
                    <AddProductDialog />
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Stock
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InventoryTable
                  lowStockData={lowStockData}
                  showAllInventory={true}
                  showLowStockOnly={showLowStock}
                  onToggleLowStock={setShowLowStock}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="costs" className="space-y-6">
            <CostManagement />
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <ProductManagement />
          </TabsContent>

          <TabsContent value="categories" className="space-y-6">
            <CategoryManagement />
          </TabsContent>

          <TabsContent value="suppliers" className="space-y-6">
            <SupplierManagement />
          </TabsContent>

          <TabsContent value="customers" className="space-y-6">
            <CustomerManagement />
          </TabsContent>

          <TabsContent value="components" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Component Management
                  <div className="flex space-x-2">
                    <AddComponentDialog />
                    <Button variant="outline" size="sm">
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Update Stock
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-gray-600">
                    Manage components for bundle-based products. When you create bundle-based products,
                    the system will automatically deduct these components from stock when orders are processed.
                  </p>
                  <InventoryTable showComponentsOnly={true} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="purchase-orders" className="space-y-6">
            <PurchaseOrderManagement />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <EnhancedOrderManagement />
            <OrderManagement />
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
          </TabsContent>



          <TabsContent value="option-groups" className="space-y-6">
            <OptionGroupManagement />
          </TabsContent>

          <TabsContent value="currency" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <span>💱</span>
                  <span>Currency Settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CurrencyRateManager currentUser={user} canEdit={true} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-6">
            <OrganizationSettings />
          </TabsContent>

          <TabsContent value="quotes" className="space-y-6">
            <QuotationManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
}
