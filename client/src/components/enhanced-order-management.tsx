import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2, Edit, AlertTriangle, Search, Filter, RefreshCw, ExternalLink, X, Printer } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { printReceipt } from "@/lib/printer-api";
import { InvoiceTemplate, useInvoiceGenerator } from "@/components/invoice-template";
import { FileText } from "lucide-react";

interface Order {
  id: string;
  orderNumber: number;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string; // Added for search functionality
  status: string;
  total: string;
  subtotal: string;
  createdAt: string;
  cashier: { firstName: string; lastName: string } | null;
  barista: { firstName: string; lastName: string } | null;
  courier: { firstName: string; lastName: string } | null;
}

interface OrderEditData {
  customerName?: string;
  customerPhone?: string;
  status?: string;
  notes?: string;
}

export function EnhancedOrderManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editForm, setEditForm] = useState<OrderEditData>({
    customerName: "",
    customerPhone: "",
    status: ""
  });
  const [viewingInvoice, setViewingInvoice] = useState<any>(null); // State for invoice preview
  const { createInvoiceFromOrder } = useInvoiceGenerator();

  // Company info for invoices (TODO: Move to settings)
  const companyInfo = {
    name: "Heavy's Retail",
    address: "123 Business Rd, Commerce City",
    phone: "+1 (555) 123-4567",
    email: "billing@heavys.com",
    taxId: "TAX-12345678"
  };

  // Fetch orders
  const { data: allOrders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Smart filtering logic
  const filteredOrders = useMemo(() => {
    let filtered = allOrders;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(order => order.status === statusFilter);
    }

    // Date filter
    if (dateFilter) {
      const filterDate = new Date(dateFilter);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate.toDateString() === filterDate.toDateString();
      });
    }

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber?.toString().includes(searchLower) ||
        order.customerName?.toLowerCase().includes(searchLower) ||
        order.customerPhone?.toLowerCase().includes(searchLower) ||
        order.customerAddress?.toLowerCase().includes(searchLower) || // Added customerAddress to search
        order.id.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allOrders, statusFilter, dateFilter, searchTerm]);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("DELETE", `/api/orders/${orderId}`, null);
      return res.json();
    },
    onSuccess: (_, orderId) => {
      toast({
        title: "Order Deleted",
        description: "Order has been successfully removed from the system",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete order",
        variant: "destructive",
      });
    },
  });

  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, data }: { orderId: string; data: OrderEditData }) => {
      const res = await apiRequest("PATCH", `/api/orders/${orderId}`, data);
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Updated",
        description: "Order details have been successfully updated",
      });
      setEditingOrder(null);
      setEditForm({ customerName: "", customerPhone: "", status: "" }); // Reset form
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'preparing': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivering': return 'bg-purple-100 text-purple-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const canDeleteOrder = (order: Order) => {
    // Only allow deletion of pending or cancelled orders to prevent data integrity issues
    return ['pending', 'cancelled'].includes(order.status);
  };

  const canEditOrder = (order: Order) => {
    // Allow editing of non-delivered orders
    return !['delivered'].includes(order.status);
  };

  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setEditForm({
      customerName: order.customerName,
      customerPhone: order.customerPhone || '',
      status: order.status,
    });
  };


  const handlePrintOrder = async (orderId: string) => {
    try {
      // 1. Fetch full order details (to get items)
      console.log('Fetching full order details for print...');
      const res = await apiRequest('GET', `/api/orders/${orderId}`);
      const fullOrder = await res.json();

      // 2. Format for printer
      const receiptData = {
        storeName: "HIGHWAY CAFE",
        orderId: fullOrder.orderNumber ? fullOrder.orderNumber.toString() : fullOrder.id.substring(0, 8),
        items: fullOrder.items.map((item: any) => ({
          name: item.product?.name || "Unknown Item",
          quantity: item.quantity,
          total: Number(item.priceAtOrder) * item.quantity // Calculate line total
        })),
        subtotal: Number(fullOrder.subtotal || fullOrder.total), // Fallback
        total: Number(fullOrder.total),
        paymentMethod: fullOrder.paymentMethod || "CASH",
        timestamp: fullOrder.createdAt,
        // Optional customer info
        phone: fullOrder.customerPhone,
        address: fullOrder.customerAddress
      };

      // 3. Send to printer
      toast({
        title: "Printing Receipt",
        description: "Sending command to printer...",
      });

      await printReceipt(receiptData);

      toast({
        title: "Print Sent",
        description: "Receipt sent to printer successfully.",
      });

    } catch (error: any) {
      console.error('Print failed:', error);
      toast({
        title: "Print Failed",
        description: error.message || "Could not print receipt",
        variant: "destructive",
      });
    }
  };

  const handleCreateInvoice = async (orderId: string) => {
    try {
      toast({ title: "Generating Invoice..." });
      const res = await apiRequest('GET', `/api/orders/${orderId}`);
      const fullOrder = await res.json();

      // Ensure items have necessary structure for invoice
      const orderWithMappedItems = {
        ...fullOrder,
        items: fullOrder.items.map((item: any) => ({
          name: item.product?.name || "Unknown Item",
          quantity: item.quantity,
          price: item.priceAtOrder, // map priceAtOrder to price for generator
          sku: item.product?.sku
        }))
      };

      const invoiceData = createInvoiceFromOrder(orderWithMappedItems, {
        name: fullOrder.customerName,
        phone: fullOrder.customerPhone,
        address: fullOrder.customerAddress
      });

      setViewingInvoice(invoiceData);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to generate invoice: " + error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading orders...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="enhanced-order-management">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Enhanced Order Management
            <Badge variant="secondary">{filteredOrders.length} orders</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters and Search */}
          <div className="flex flex-wrap items-end space-x-4 mb-6 gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by order #, customer name, phone, address..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="w-48">
              <Label htmlFor="status-filter">Filter by Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Orders</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="preparing">Preparing</SelectItem>
                  <SelectItem value="ready">Ready</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem> {/* Added cancelled to filter */}
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="date-filter">Filter by Date</Label>
              <Input
                id="date-filter"
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              />
            </div>

            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>

            {(searchTerm || statusFilter !== "all" || dateFilter) && (
              <Button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                  setDateFilter('');
                }}
                variant="outline"
                className="text-red-600"
              >
                Clear Filters
              </Button>
            )}
          </div>

          {/* Results summary */}
          <div className="mb-4">
            <Badge variant="outline" className="mb-2">
              Showing {filteredOrders.length} of {allOrders.length} orders
            </Badge>
            {(searchTerm || statusFilter !== "all" || dateFilter) && (
              <div className="text-sm text-muted-foreground">
                Filters applied:
                {searchTerm && <span className="ml-1 font-medium">Search: "{searchTerm}"</span>}
                {statusFilter !== "all" && <span className="ml-1 font-medium">Status: {statusFilter}</span>}
                {dateFilter && <span className="ml-1 font-medium">Date: {new Date(dateFilter).toLocaleDateString()}</span>}
              </div>
            )}
          </div>

          {/* Orders Table */}
          {filteredOrders.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No orders found matching your criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Staff</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono">#{order.orderNumber}</TableCell>
                    <TableCell className="font-medium">{order.customerName}</TableCell>
                    <TableCell>{order.customerPhone || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(order.status)}>
                        {order.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">${order.total}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">
                      {order.cashier && (
                        <div>Cashier: {order.cashier.firstName} {order.cashier.lastName}</div>
                      )}
                      {order.barista && (
                        <div>Barista: {order.barista.firstName} {order.barista.lastName}</div>
                      )}
                      {order.courier && (
                        <div>Courier: {order.courier.firstName} {order.courier.lastName}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {canEditOrder(order) && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditOrder(order)}
                            data-testid={`button-edit-${order.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePrintOrder(order.id)}
                          title="Print Receipt"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateInvoice(order.id)}
                          title="Print A4 Invoice"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>

                        {canDeleteOrder(order) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                data-testid={`button-delete-${order.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle className="flex items-center gap-2">
                                  <AlertTriangle className="h-5 w-5 text-red-500" />
                                  Delete Order #{order.orderNumber}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this order? This action cannot be undone.
                                  <div className="mt-2 p-3 bg-gray-50 rounded">
                                    <p><strong>Customer:</strong> {order.customerName}</p>
                                    <p><strong>Total:</strong> ${order.total}</p>
                                    <p><strong>Status:</strong> {order.status}</p>
                                  </div>
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => deleteOrderMutation.mutate(order.id)}
                                  className="bg-red-600 hover:bg-red-700"
                                  data-testid={`confirm-delete-${order.id}`}
                                >
                                  Delete Order
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Order Dialog */}
      {editingOrder && (
        <AlertDialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
          <AlertDialogContent className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Order #{editingOrder.orderNumber}</AlertDialogTitle>
              <AlertDialogDescription>
                Update order details. Some fields may be restricted based on order status.
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-customer-name">Customer Name</Label>
                <Input
                  id="edit-customer-name"
                  value={editForm.customerName || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                  data-testid="input-edit-customer-name"
                />
              </div>

              <div>
                <Label htmlFor="edit-customer-phone">Customer Phone</Label>
                <Input
                  id="edit-customer-phone"
                  value={editForm.customerPhone || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  data-testid="input-edit-customer-phone"
                />
              </div>

              <div>
                <Label htmlFor="edit-status">Order Status</Label>
                <Select
                  value={editForm.status}
                  onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}
                >
                  <SelectTrigger data-testid="select-edit-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="ready">Ready</SelectItem>
                    <SelectItem value="delivering">Delivering</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => updateOrderMutation.mutate({
                  orderId: editingOrder.id,
                  data: editForm
                })}
                data-testid="button-save-order-changes"
              >
                Save Changes
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
      {viewingInvoice && (
        <InvoiceTemplate
          invoice={viewingInvoice}
          company={companyInfo}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div>
  );
}