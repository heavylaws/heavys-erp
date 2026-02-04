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
import { useAuth } from "@/hooks/useAuth";
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
  discountTotal?: string; // Added discount field
}

interface OrderEditData {
  customerName?: string;
  customerPhone?: string;
  status?: string;
  notes?: string;
  subtotal?: string;
  total?: string;
  discountTotal?: string;
}

export function EnhancedOrderManagement() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);

  // State for editing items
  const [editForm, setEditForm] = useState<OrderEditData>({
    customerName: "",
    customerPhone: "",
    status: ""
  });
  const [editItems, setEditItems] = useState<any[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemId, setNewItemId] = useState<string>("");

  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const { createInvoiceFromOrder } = useInvoiceGenerator();

  // Fetch receipt settings (Moved up to avoid ReferenceError)
  const { data: receiptSettings } = useQuery<any>({
    queryKey: ['/api/settings/receipt'],
  });

  // Company info for invoices (using receipt settings or defaults)
  const companyInfo = {
    name: receiptSettings?.businessName || "Heavy's Retail",
    address: receiptSettings?.address || "123 Business Rd, Commerce City",
    phone: receiptSettings?.phoneNumber || "+1 (555) 123-4567",
    email: receiptSettings?.email || "billing@heavys.com",
    taxId: receiptSettings?.taxId || "TAX-12345678"
  };

  // Fetch orders
  const { data: allOrders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  // Fetch products for adding items
  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    enabled: !!editingOrder // Only fetch when editing
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
        order.customerAddress?.toLowerCase().includes(searchLower) ||
        order.id.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allOrders, statusFilter, dateFilter, searchTerm]);

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await apiRequest("DELETE", `/api/orders/${orderId}`, null);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete order");
      }
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

  // Enhanced mutation to handle items update
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, data, items }: { orderId: string; data: OrderEditData, items?: any[] }) => {
      // Use PUT for full update with items, PATCH for partial
      const method = items ? "PUT" : "PATCH";
      const payload = items ? { order: data, items } : data;

      const res = await apiRequest(method, `/api/orders/${orderId}`, payload);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update order");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Order Updated",
        description: "Order details have been successfully updated",
      });
      setEditingOrder(null);
      setEditForm({ customerName: "", customerPhone: "", status: "" });
      setEditItems([]);
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
    if (user?.role === 'admin') return true;
    return ['pending', 'cancelled'].includes(order.status);
  };

  const canEditOrder = (order: Order) => {
    // Admin override: can edit ANY order
    if (user?.role === 'admin') return true;
    // Standard rule: can only edit non-delivered
    return !['delivered'].includes(order.status);
  };

  const handleEditOrder = async (order: Order) => {
    try {
      // 1. Fetch full order details including items
      const res = await apiRequest('GET', `/api/orders/${order.id}`);
      if (!res.ok) throw new Error("Failed to fetch order details");
      const fullOrder = await res.json();

      setEditingOrder(fullOrder); // Use full order

      setEditForm({
        customerName: fullOrder.customerName,
        customerPhone: fullOrder.customerPhone || '',
        status: fullOrder.status,
      });

      // Map items for editing
      const mappedItems = (fullOrder.items || []).map((item: any) => ({
        ...item,
        // Ensure numeric values for inputs
        price: item.priceAtOrder || item.unitPrice || item.product?.price || 0,
        quantity: item.quantity
      }));
      setEditItems(mappedItems);

    } catch (error) {
      console.error("Error fetching order for edit:", error);
      toast({
        title: "Error",
        description: "Could not load order details for editing",
        variant: "destructive"
      });
    }
  };

  // Helper to calculate editing total
  const editingTotal = editItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);

  const handleAddItem = () => {
    if (!newItemId) return;
    const product = products.find(p => p.id === newItemId);
    if (!product) return;

    setEditItems(prev => [
      ...prev,
      {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        total: product.price, // Initial total
        product: product // Keep reference for display
      }
    ]);
    setNewItemId("");
    setIsAddingItem(false);
  };

  const handleUpdateItem = (index: number, field: string, value: any) => {
    setEditItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  };

  const handleRemoveItem = (index: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== index));
  };


  const handlePrintOrder = async (orderId: string) => {
    try {
      console.log('Fetching full order details for print...');
      const res = await apiRequest('GET', `/api/orders/${orderId}`);
      const fullOrder = await res.json();

      const receiptData = {
        storeName: receiptSettings?.businessName || "HIGHWAY CAFE",
        orderId: fullOrder.orderNumber ? fullOrder.orderNumber.toString() : fullOrder.id.substring(0, 8),
        items: fullOrder.items.map((item: any) => ({
          name: item.product?.name || "Unknown Item",
          quantity: item.quantity,
          total: (item.priceAtOrder ? Number(item.priceAtOrder) : (item.product?.price ? Number(item.product.price) : 0)) * item.quantity
        })),
        subtotal: Number(fullOrder.subtotal || fullOrder.total),
        total: Number(fullOrder.total),
        paymentMethod: fullOrder.paymentMethod || "CASH",
        timestamp: fullOrder.createdAt,
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

      const orderWithMappedItems = {
        ...fullOrder,
        items: fullOrder.items.map((item: any) => ({
          name: item.product?.name || "Unknown Item",
          quantity: item.quantity,
          price: item.unitPrice ? Number(item.unitPrice) : (item.priceAtOrder ? Number(item.priceAtOrder) : (item.product?.price ? Number(item.product.price) : 0)),
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
      toast({ title: "Error", description: "Failed to generate invoice: " + error.message, variant: "destructive" });
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
          <div className="flex flex-wrap items-end space-x-4 mb-6 gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="search">Search Orders</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  id="search"
                  placeholder="Search by order #, customer name, phone..."
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
                  <SelectItem value="delivering">Delivering</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-48">
              <Label htmlFor="date-filter">Filter by Date</Label>
              <Input id="date-filter" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
            </div>

            <Button onClick={() => refetch()} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" /> Refresh
            </Button>

            {(searchTerm || statusFilter !== "all" || dateFilter) && (
              <Button
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateFilter(''); }}
                variant="outline"
                className="text-red-600"
              >
                Clear Filters
              </Button>
            )}
          </div>

          <div className="mb-4">
            <Badge variant="outline" className="mb-2">
              Showing {filteredOrders.length} of {allOrders.length} orders
            </Badge>
          </div>

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
                  <TableHead>Discount</TableHead>
                  <TableHead>Net Total</TableHead>
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
                      <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground line-through">${order.subtotal}</TableCell>
                    <TableCell className="font-mono text-red-600">-${order.discountTotal || '0.00'}</TableCell>
                    <TableCell className="font-mono font-bold">${order.total}</TableCell>
                    <TableCell>{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">
                      {order.cashier && <div>Cashier: {order.cashier.firstName}</div>}
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
                        <Button variant="outline" size="sm" onClick={() => handlePrintOrder(order.id)}>
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleCreateInvoice(order.id)}>
                          <FileText className="h-4 w-4" />
                        </Button>
                        {canDeleteOrder(order) && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Order #{order.orderNumber}</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure? This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteOrderMutation.mutate(order.id)} className="bg-red-600">
                                  Delete
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

      {/* Enhanced Edit Order Dialog */}
      {editingOrder && (
        <AlertDialog open={!!editingOrder} onOpenChange={() => setEditingOrder(null)}>
          <AlertDialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <AlertDialogHeader>
              <AlertDialogTitle>Edit Order #{editingOrder.orderNumber}</AlertDialogTitle>
              <AlertDialogDescription>
                Modify order details and items.
                {user?.role === 'admin' && <span className="text-red-600 block mt-1 font-bold"> Note: As Admin, changes to 'Sold' orders do not automatically adjust inventory.</span>}
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Metadata */}
              <div className="space-y-4 md:col-span-1 border-r pr-4">
                <h3 className="font-semibold text-sm text-gray-900">Order Details</h3>
                <div>
                  <Label>Customer Name</Label>
                  <Input
                    value={editForm.customerName || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customerName: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Customer Phone</Label>
                  <Input
                    value={editForm.customerPhone || ''}
                    onChange={(e) => setEditForm(prev => ({ ...prev, customerPhone: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
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

              {/* Right Column: Items */}
              <div className="space-y-4 md:col-span-2">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-sm text-gray-900">Order Items</h3>
                  {!isAddingItem ? (
                    <Button size="sm" variant="outline" onClick={() => setIsAddingItem(true)}>
                      + Add Item
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Select value={newItemId} onValueChange={setNewItemId}>
                        <SelectTrigger className="w-[200px] h-8 text-xs">
                          <SelectValue placeholder="Select Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name} (${p.price})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={handleAddItem} disabled={!newItemId}>Add</Button>
                      <Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)}>Cancel</Button>
                    </div>
                  )}
                </div>

                <div className="border rounded-md overflow-hidden bg-white">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="w-[40%]">Item</TableHead>
                        <TableHead className="w-[15%]">Qty</TableHead>
                        <TableHead className="w-[20%]">Price</TableHead>
                        <TableHead className="w-[15%]">Total</TableHead>
                        <TableHead className="w-[10%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editItems.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium text-sm">
                            {item.name || item.product?.name}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              className="h-8 w-16"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              className="h-8 w-20"
                              value={item.price}
                              onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                            />
                          </TableCell>
                          <TableCell className="text-sm">
                            ${(Number(item.price) * Number(item.quantity)).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-red-500" onClick={() => handleRemoveItem(idx)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {editItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 py-4">
                            No items in order
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex flex-col gap-2 pt-2 border-t">
                  <div className="flex justify-end gap-4 items-center">
                    <div className="text-sm font-medium text-gray-500">Discount:</div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="text-right h-8"
                        value={editingOrder.discountTotal || "0"}
                        onChange={(e) => setEditingOrder(prev => prev ? ({ ...prev, discountTotal: e.target.value }) : null)}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-4 items-center">
                    <div className="text-sm font-medium text-gray-500">New Total Estimate:</div>
                    <div className="text-xl font-bold text-green-700">${(editingTotal - Number(editingOrder.discountTotal || 0)).toFixed(2)}</div>
                  </div>
                </div>
              </div>
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  // Calculate new totals logic
                  const newSubtotal = editItems.reduce((sum, item) => sum + (Number(item.price) * Number(item.quantity)), 0);
                  const currentDiscount = Number(editingOrder.discountTotal || 0);
                  const newTotal = newSubtotal - currentDiscount;

                  updateOrderMutation.mutate({
                    orderId: editingOrder.id,
                    data: {
                      ...editForm,
                      subtotal: newSubtotal.toFixed(2),
                      total: newTotal.toFixed(2),
                      discountTotal: currentDiscount.toFixed(2)
                    },
                    items: editItems.map(i => ({
                      productId: i.productId || i.product?.id || i.product?.productId,
                      quantity: Number(i.quantity),
                      unitPrice: String(i.price),
                      total: String(Number(i.price) * Number(i.quantity)),
                      modifications: i.modifications
                    }))
                  })
                }}
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