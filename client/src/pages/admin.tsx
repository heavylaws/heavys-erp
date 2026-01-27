import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, Users, Package, FolderOpen, ChefHat, ShoppingCart, LogOut, Settings, Terminal, Building2 } from "lucide-react";
import { UserManagement } from "@/components/user-management";
import { ProductManagement } from "@/components/product-management";
import { CategoryManagement } from "@/components/category-management";
import { OrderManagement } from "@/components/order-management";
import { InventoryTable } from "@/components/inventory-table";
import { SalesChart } from "@/components/sales-chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CurrencyRateManager } from "@/components/currency-rate-manager";
import { Download, RotateCcw } from "lucide-react";
import { formatDualCurrency } from '@shared/currency-utils';
import { useExchangeRate } from '@/hooks/useExchangeRate';
import { OptionGroupManagement } from '@/components/option-group-management';
import { SupplierManagement } from '@/components/supplier-management';
import { CustomerManagement } from '@/components/customer-management';
import { PurchaseOrderManagement } from '@/components/purchase-order-management';
import { OrganizationSettings } from '@/components/organization-settings';
import { Truck, ClipboardList } from "lucide-react";

interface Analytics {
  sales: { total: number; count: number };
  topProducts: Array<{ product: any; sales: number; revenue: number }>;
  lowStockCount: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLiveOnline, setIsLiveOnline] = useState(false);

  // Real-time Dashboard: WebSocket Listener (Phase 9 - Admin Upgrade)
  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setIsLiveOnline(true);
    socket.onclose = () => setIsLiveOnline(false);

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'order_update') {
          // Invalidate analytics to trigger a soft refresh
          queryClient.invalidateQueries({ queryKey: ["/api/analytics/today"] });
        }
      } catch (e) {
        console.error("WS Parse Error", e);
      }
    };

    return () => socket.close();
  }, [queryClient]);

  // Redirect if not authorized (Authentication is handled by App.tsx)
  useEffect(() => {
    if (!isLoading && user && (user as any).role !== 'admin') {
      toast({
        title: "Access Denied",
        description: "You don't have admin permissions to access this page.",
        variant: "destructive",
      });
      setTimeout(() => {
        setLocation("/");
      }, 1000);
      return;
    }
  }, [isLoading, user, toast, setLocation]);

  // Fetch analytics data
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ['/api/analytics/today']
  });

  // Fetch low stock items
  const { data: lowStockData } = useQuery({
    queryKey: ['/api/inventory/low-stock']
  });

  // Fetch all users for admin overview
  const { data: allUsers = [] } = useQuery({
    queryKey: ['/api/users']
  });

  // Simple recent activity (last 50) for a quick glance
  const { data: activityLogs = [], isLoading: activityLoading, refetch: refetchActivity } = useQuery({
    queryKey: ['admin-activity-logs', 50],
    queryFn: async () => {
      const res = await fetch('/api/admin/activity-logs?limit=50', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch activity logs');
      return res.json();
    }
  });

  // Filtered/paginated activity logs
  const [logFilters, setLogFilters] = useState({
    action: '',
    userId: '',
    success: '' as '' | 'true' | 'false',
    from: '',
    to: '',
    page: 1,
    pageSize: 25
  });

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set('limit', String(logFilters.pageSize));
    params.set('offset', String((logFilters.page - 1) * logFilters.pageSize));
    if (logFilters.action) params.set('action', logFilters.action);
    if (logFilters.userId) params.set('userId', logFilters.userId);
    if (logFilters.success) params.set('success', logFilters.success);
    if (logFilters.from) params.set('from', logFilters.from);
    if (logFilters.to) params.set('to', logFilters.to);
    return params.toString();
  }, [logFilters]);

  const { data: pagedLogs, isLoading: pagedLoading } = useQuery({
    queryKey: ['admin-activity-logs-paged', queryString],
    queryFn: async () => {
      const res = await fetch(`/api/admin/activity-logs/paged?${queryString}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to fetch paged activity logs');
      return res.json();
    }
  });

  // Fetch current exchange rate
  const { data: currentRate } = useExchangeRate();

  if (isLoading || analyticsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  const totalLowStockItems = ((lowStockData as any)?.products?.length || 0) + ((lowStockData as any)?.ingredients?.length || 0);
  const activeUsers = (allUsers as any[]).filter((u: any) => u.isActive).length;
  const totalRevenue = (analytics as any)?.sales?.total || 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 p-2 rounded-lg">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">Full system management and control</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="flex bg-blue-100 border-blue-300 text-blue-900 font-bold hover:bg-blue-200">
                    <Terminal className="h-4 w-4 mr-2" />
                    Deployment
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>POS Client Deployment (Linux)</DialogTitle>
                    <DialogDescription>
                      Install the POS application on a new Linux machine (Mint/Ubuntu)
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 py-4">
                    <div className="bg-slate-50 p-4 rounded-md border border-slate-200">
                      <h4 className="font-semibold mb-2 text-sm text-slate-800">Option A: One-Step Installation (Recommended)</h4>
                      <p className="text-sm text-slate-600 mb-2">
                        Run this command on the Client Machine terminal:
                      </p>
                      <code className="block bg-slate-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto font-mono">
                        wget http://localhost:5003/api/installer/script -O install.sh && sudo bash install.sh
                      </code>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="border rounded-md p-4 space-y-2">
                        <div className="font-semibold text-sm">Manual Download</div>
                        <div className="text-xs text-gray-500 mb-2">Download individual files</div>
                        <div className="flex gap-2 flex-col">
                          <Button
                            variant="outline" size="sm"
                            onClick={() => window.open('/api/installer/script')}
                          >
                            <Terminal className="h-4 w-4 mr-2" />
                            Download Script
                          </Button>
                          <Button
                            variant="outline" size="sm"
                            onClick={() => window.open('/api/installer/app')}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download AppImage
                          </Button>
                        </div>
                      </div>

                      <div className="border rounded-md p-4 bg-gray-50 text-xs text-gray-600">
                        <strong>What this does:</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1">
                          <li>Installs Printer Drivers (USB)</li>
                          <li>Fixes Permission Issues (udev)</li>
                          <li>Installs the POS App</li>
                          <li>Creates Desktop Shortcut</li>
                          <li>Connects to Server (localhost:5003)</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {user && (user as any).firstName} {user && (user as any).lastName}
                </p>
                <p className="text-xs text-gray-600 flex items-center">
                  <Shield className="h-3 w-3 mr-1" />
                  System Administrator
                </p>
              </div>
              <Button variant="outline" onClick={async () => {
                try {
                  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
                  window.location.href = '/';
                } catch (error) {
                  window.location.href = '/';
                }
              }}>
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Admin Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                    {isLiveOnline && (
                      <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live Updates Active"></span>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-green-600">
                    {currentRate?.rate ? formatDualCurrency(totalRevenue, parseFloat((currentRate as any).rate)) : `$${totalRevenue.toFixed(2)}`}
                  </p>
                  <p className="text-xs text-green-600">Today's earnings</p>
                </div>
                <div className="bg-green-100 p-3 rounded-lg">
                  <Settings className="text-green-600 h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Active Users</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {activeUsers}
                  </p>
                  <p className="text-xs text-blue-600">System users</p>
                </div>
                <div className="bg-blue-100 p-3 rounded-lg">
                  <Users className="text-blue-600 h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Orders Today</p>
                  <p className="text-2xl font-bold text-purple-600">
                    {(analytics as any)?.sales?.count || 0}
                  </p>
                  <p className="text-xs text-purple-600">Total processed</p>
                </div>
                <div className="bg-purple-100 p-3 rounded-lg">
                  <ShoppingCart className="text-purple-600 h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">System Alerts</p>
                  <p className="text-2xl font-bold text-red-600">
                    {totalLowStockItems}
                  </p>
                  <p className="text-xs text-red-600">Low stock items</p>
                </div>
                <div className="bg-red-100 p-3 rounded-lg">
                  <Package className="text-red-600 h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Client Deployment (New Section) */}
        <Card className="mb-8 border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Terminal className="h-5 w-5 text-neutral" />
              <span>POS Client Deployment (Linux)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-sm text-slate-800">One-Step Installation</h4>
                <p className="text-sm text-slate-600 mb-2">
                  Run this command on the new Client Machine to automatically install the POS App and configure the printer:
                </p>
                <code className="block bg-slate-900 text-green-400 p-3 rounded-md text-xs overflow-x-auto font-mono">
                  wget http://localhost:5003/api/installer/script -O install.sh && sudo bash install.sh
                </code>
              </div>

              <div className="flex gap-4 items-center justify-end">
                <Button
                  variant="outline"
                  className="flex flex-col h-auto py-3 px-6 items-center gap-2 border-slate-300 bg-white hover:bg-slate-50"
                  onClick={() => window.open('/api/installer/script')}
                >
                  <Terminal className="h-5 w-5 text-slate-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Download Script</div>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="flex flex-col h-auto py-3 px-6 items-center gap-2 border-slate-300 bg-white hover:bg-slate-50"
                  onClick={() => window.open('/api/installer/app')}
                >
                  <Download className="h-5 w-5 text-blue-600" />
                  <div className="text-center">
                    <div className="font-semibold text-sm">Download AppImage</div>
                  </div>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Critical Alerts */}
        {totalLowStockItems > 0 && (
          <Alert className="mb-8 border-red-200 bg-red-50">
            <Package className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Critical System Alert</AlertTitle>
            <AlertDescription className="text-red-700">
              {totalLowStockItems} items are critically low on stock and require immediate attention to prevent service disruption.
            </AlertDescription>
          </Alert>
        )}

        {/* Admin Management Tabs */}
        <Tabs defaultValue="users" className="w-full">
          {/* Use horizontal scroll for tab list to prevent wrapping on smaller screens */}
          <TabsList className="flex w-full overflow-x-auto pb-2 justify-start h-auto flex-nowrap gap-2 bg-transparent p-0 no-scrollbar">
            <TabsTrigger value="users" className="flex-shrink-0">
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger value="products" className="flex-shrink-0">
              <Package className="h-4 w-4 mr-2" />
              Products
            </TabsTrigger>
            <TabsTrigger value="categories" className="flex-shrink-0">
              <FolderOpen className="h-4 w-4 mr-2" />
              Categories
            </TabsTrigger>
            <TabsTrigger value="suppliers" className="flex-shrink-0">
              <Truck className="h-4 w-4 mr-2" />
              Suppliers
            </TabsTrigger>
            <TabsTrigger value="customers" className="flex-shrink-0">
              <Users className="h-4 w-4 mr-2" />
              Customers
            </TabsTrigger>
            <TabsTrigger value="purchase-orders" className="flex-shrink-0">
              <ClipboardList className="h-4 w-4 mr-2" />
              PO
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex-shrink-0">
              <ShoppingCart className="h-4 w-4 mr-2" />
              Sales
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex-shrink-0">
              <Settings className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex-shrink-0">
              💱
              Currency
            </TabsTrigger>
            <TabsTrigger value="inventory" className="flex-shrink-0">
              📦
              Inventory
            </TabsTrigger>
            <TabsTrigger value="option-groups" className="flex-shrink-0">
              <span className="mr-2">🧩</span>
              Options
            </TabsTrigger>
            <TabsTrigger value="organization" className="flex-shrink-0">
              <Building2 className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-6">
            <UserManagement />
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

          <TabsContent value="purchase-orders" className="space-y-6">
            <PurchaseOrderManagement />
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <OrderManagement />
          </TabsContent>


          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sales Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <SalesChart />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>System Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Database Status</span>
                      <Badge className="bg-green-600">Online</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">API Health</span>
                      <Badge className="bg-green-600">Operational</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Active Sessions</span>
                      <Badge variant="secondary">{activeUsers}</Badge>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="font-medium">Low Stock Alerts</span>
                      <Badge variant={totalLowStockItems > 0 ? "destructive" : "default"}>
                        {totalLowStockItems}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Backups */}
              <Card>
                <CardHeader>
                  <CardTitle>System Backups</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      Manage database backups, restore points, and download SQL dumps.
                    </p>
                    <Button
                      className="w-full"
                      onClick={() => setLocation('/admin/backups')}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Open Backup Manager
                    </Button>
                    <p className="text-xs text-gray-500">
                      View, create, download, and restore system backups.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Restore */}
              <Card>
                <CardHeader>
                  <CardTitle>Restore From Backup</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">Upload a previously downloaded .sql backup to restore the database. This will overwrite current data.</p>
                    <div className="flex items-center gap-3">
                      <input id="backupFile" type="file" accept=".sql,application/sql,text/plain" className="block text-sm" />
                      <div className="flex items-center gap-2">
                        <input id="confirmRestore" type="checkbox" className="mr-1" />
                        <label htmlFor="confirmRestore" className="text-sm">I understand this will overwrite current data</label>
                      </div>
                    </div>
                    <Button
                      variant="destructive"
                      onClick={async () => {
                        try {
                          const fileInput = document.getElementById('backupFile') as HTMLInputElement | null;
                          const confirm = (document.getElementById('confirmRestore') as HTMLInputElement | null)?.checked;
                          if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
                            throw new Error('Please choose a .sql backup file');
                          }
                          if (!confirm) {
                            throw new Error('Please confirm you understand this will overwrite current data');
                          }
                          const file = fileInput.files[0];
                          const text = await file.text();
                          const res = await fetch('/api/admin/restore/db?drop=true', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/sql' },
                            body: text,
                            credentials: 'include'
                          });
                          if (!res.ok) {
                            const t = await res.json().catch(() => ({}));
                            throw new Error(t?.message || `Restore failed (${res.status})`);
                          }
                          toast({ title: 'Restore started', description: 'Database restore completed successfully.' });
                        } catch (err: any) {
                          toast({ title: 'Restore failed', description: err?.message || 'Unable to restore database', variant: 'destructive' });
                        }
                      }}
                    >
                      <RotateCcw className="h-4 w-4 mr-2" />
                      Restore DB from Backup
                    </Button>
                    <p className="text-xs text-gray-500">Requires psql in the server/container. In our Docker image, it’s preinstalled.</p>
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs - quick list */}
              <Card>
                <CardHeader>
                  <CardTitle>Recent Admin Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-gray-600">Last 50 backup/restore actions</p>
                      <Button variant="outline" size="sm" onClick={() => refetchActivity()}>Refresh</Button>
                    </div>
                    {activityLoading ? (
                      <p className="text-sm text-gray-500">Loading activity…</p>
                    ) : activityLogs.length === 0 ? (
                      <p className="text-sm text-gray-500">No recent admin activity.</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 max-h-80 overflow-auto rounded-md border">
                        {activityLogs.map((log: any) => (
                          <li key={log.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-gray-900">{log.action}</span>
                                <span className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
                              </div>
                              {log.details?.filename && (
                                <div className="text-xs text-gray-600 truncate">file: {log.details.filename}</div>
                              )}
                              {log.details?.error && (
                                <div className="text-xs text-red-600 truncate">err: {String(log.details.error).slice(0, 120)}</div>
                              )}
                              {typeof log.details?.exitCode !== 'undefined' && (
                                <div className="text-xs text-gray-600">exit: {log.details.exitCode}</div>
                              )}
                            </div>
                            <Badge className={log.success ? 'bg-green-600' : 'bg-red-600'}>
                              {log.success ? 'Success' : 'Failed'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Activity Logs - filters & pagination */}
              <Card>
                <CardHeader>
                  <CardTitle>Activity Logs (Filtered)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        placeholder="Action contains"
                        value={logFilters.action}
                        onChange={(e) => setLogFilters((s) => ({ ...s, action: e.target.value, page: 1 }))}
                      />
                      <input
                        className="border rounded px-2 py-1 text-sm"
                        placeholder="User ID"
                        value={logFilters.userId}
                        onChange={(e) => setLogFilters((s) => ({ ...s, userId: e.target.value, page: 1 }))}
                      />
                      <select
                        className="border rounded px-2 py-1 text-sm"
                        value={logFilters.success}
                        onChange={(e) => setLogFilters((s) => ({ ...s, success: e.target.value as any, page: 1 }))}
                      >
                        <option value="">All Results</option>
                        <option value="true">Success</option>
                        <option value="false">Failed</option>
                      </select>
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1 text-sm"
                        value={logFilters.from}
                        onChange={(e) => setLogFilters((s) => ({ ...s, from: e.target.value, page: 1 }))}
                      />
                      <input
                        type="datetime-local"
                        className="border rounded px-2 py-1 text-sm"
                        value={logFilters.to}
                        onChange={(e) => setLogFilters((s) => ({ ...s, to: e.target.value, page: 1 }))}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Total: {(pagedLogs as any)?.total ?? 0}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={logFilters.pageSize}
                          onChange={(e) => setLogFilters((s) => ({ ...s, pageSize: parseInt(e.target.value, 10) || 25, page: 1 }))}
                        >
                          <option value={10}>10</option>
                          <option value={25}>25</option>
                          <option value={50}>50</option>
                          <option value={100}>100</option>
                        </select>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogFilters((s) => ({ ...s, page: Math.max(1, s.page - 1) }))}
                          disabled={(logFilters.page || 1) <= 1}
                        >
                          Prev
                        </Button>
                        <span className="text-sm">Page {logFilters.page}</span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLogFilters((s) => ({ ...s, page: s.page + 1 }))}
                          disabled={((pagedLogs as any)?.rows?.length || 0) < logFilters.pageSize}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                    {pagedLoading ? (
                      <p className="text-sm text-gray-500">Loading…</p>
                    ) : ((pagedLogs as any)?.rows?.length || 0) === 0 ? (
                      <p className="text-sm text-gray-500">No logs match current filters.</p>
                    ) : (
                      <ul className="divide-y divide-gray-200 rounded-md border max-h-96 overflow-auto">
                        {(pagedLogs as any).rows.map((log: any) => (
                          <li key={log.id} className="p-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium text-gray-900">{log.action}</span>
                                <span className="text-xs text-gray-500">{new Date(log.createdAt).toLocaleString()}</span>
                                {log.userId && <span className="text-xs text-gray-500">user: {log.userId}</span>}
                              </div>
                              {log.details?.path && (
                                <div className="text-xs text-gray-600 truncate">{log.details.method} {log.details.path} • {log.details.status} • {log.details.duration}ms</div>
                              )}
                              {log.details?.filename && (
                                <div className="text-xs text-gray-600 truncate">file: {log.details.filename}</div>
                              )}
                              {log.details?.error && (
                                <div className="text-xs text-red-600 truncate">err: {String(log.details.error).slice(0, 160)}</div>
                              )}
                            </div>
                            <Badge className={log.success ? 'bg-green-600' : 'bg-red-600'}>
                              {log.success ? 'Success' : 'Failed'}
                            </Badge>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
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

          <TabsContent value="inventory" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Package className="h-5 w-5" />
                  <span>Inventory Management</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InventoryTable />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="option-groups" className="space-y-6">
            <OptionGroupManagement />
          </TabsContent>

          <TabsContent value="organization" className="space-y-6">
            <OrganizationSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}