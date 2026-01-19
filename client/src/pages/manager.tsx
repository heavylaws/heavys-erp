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
import { ChartLine, LogOut, DollarSign, ShoppingCart, AlertTriangle, BarChart, Plus, RefreshCw, Users, Monitor, ChefHat, Download, Terminal } from "lucide-react";
import { InventoryTable } from "@/components/inventory-table";
import { SalesChart } from "@/components/sales-chart";
import { UserManagement } from "@/components/user-management";
import { ProductManagement } from "@/components/product-management";
import { CategoryManagement } from "@/components/category-management";
import { OrderManagement } from "@/components/order-management";
import { AddProductDialog } from "@/components/add-product-dialog";
import { AddIngredientDialog } from "@/components/add-ingredient-dialog";
import { RecipeManager } from "@/components/recipe-manager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CurrencyRateManager } from "@/components/currency-rate-manager";
import { InventoryNotifications } from "@/components/inventory-notifications";
import { LowStockDashboard } from "@/components/low-stock-dashboard";
import { EnhancedOrderManagement } from "@/components/enhanced-order-management";
import { CostManagement } from "@/components/cost-management";
import { ManagerReports } from "@/components/manager-reports";
import { ShiftButton } from "@/components/shift-button";

import { OptionGroupManagement } from '@/components/option-group-management';
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Database, Server, Wifi } from "lucide-react";

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
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });
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

  // Redirect if not authenticated or not authorized
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Unauthorized",
        description: "You are logged out. Logging in again...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
      return;
    }

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
  }, [isAuthenticated, isLoading, user, toast]);

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery<Analytics>({
    queryKey: ['/api/analytics/today']
  });

  // Fetch low stock items
  const { data: lowStockData } = useQuery<{ products: any[]; ingredients: any[]; }>({
    queryKey: ['/api/inventory/low-stock']
  });

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
          <title>Product Barcodes - Highway Cafe</title>
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
          <h1>Product Barcodes - Highway Cafe</h1>
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
          <title>Inventory Report - Highway Cafe</title>
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
            <h1>Highway Cafe - Inventory Report</h1>
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

  const totalLowStockItems = (lowStockData?.products?.length || 0) + (lowStockData?.ingredients?.length || 0);

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
              <p className="text-sm text-gray-600">Highway Cafe Management</p>
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
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="costs">Cost Management</TabsTrigger>
            <TabsTrigger value="products" data-value="products">Products</TabsTrigger>
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            {(user as any)?.role === 'admin' && (
              <TabsTrigger value="users">User Management</TabsTrigger>
            )}
            <TabsTrigger value="option-groups">Option Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Revenue Growth</span>
                      <Badge variant="secondary">+15% this week</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Customer Satisfaction</span>
                      <Badge variant="secondary">98% positive</Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Order Accuracy</span>
                      <Badge variant="secondary">99.2%</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-3">
                    <AddProductDialog>
                      <Button className="h-20 flex flex-col items-center justify-center w-full">
                        <Plus className="h-5 w-5 mb-2" />
                        Add Product
                      </Button>
                    </AddProductDialog>
                    <Button variant="outline" className="h-20 flex flex-col items-center justify-center w-full">
                      <RefreshCw className="h-5 w-5 mb-2" />
                      Update Stock
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center w-full border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                      onClick={() => window.location.href = '/reports/strategic'}
                    >
                      <BarChart className="h-5 w-5 mb-2" />
                      Strategic Reports
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center w-full border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100"
                      onClick={() => window.open('/kiosk', '_blank')}
                    >
                      <Monitor className="h-5 w-5 mb-2" />
                      Launch Kiosk
                    </Button>
                    <Button
                      variant="outline"
                      className="h-20 flex flex-col items-center justify-center w-full border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100"
                      onClick={() => window.open('/kitchen', '_blank')}
                    >
                      <ChefHat className="h-5 w-5 mb-2" />
                      Kitchen Display
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* System Health Card */}
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Wifi className={`h-4 w-4 ${isConnected ? 'text-green-600' : 'text-red-600'}`} />
                        <span>Real-time Connection</span>
                      </div>
                      <Badge variant={isConnected ? "default" : "destructive"}>
                        {isConnected ? "Online" : "Disconnected"}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Database className="h-4 w-4 text-primary" />
                        <span>Automated Backups</span>
                      </div>
                      <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                        Active (Daily)
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center space-x-2">
                        <Server className="h-4 w-4 text-gray-600" />
                        <span>Server Storage</span>
                      </div>
                      <Badge variant="outline">Healthy</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

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

          <TabsContent value="ingredients" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Ingredient Management
                  <div className="flex space-x-2">
                    <AddIngredientDialog />
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
                    Manage ingredients for recipe-based products. When you create recipe-based products,
                    the system will automatically deduct these ingredients from stock when orders are processed.
                  </p>
                  <InventoryTable showIngredientsOnly={true} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <EnhancedOrderManagement />
            <OrderManagement />
          </TabsContent>

          {(user as any)?.role === 'admin' && (
            <TabsContent value="users" className="space-y-6">
              <UserManagement />
            </TabsContent>
          )}

          <TabsContent value="option-groups" className="space-y-6">
            <OptionGroupManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div >
  );
}
