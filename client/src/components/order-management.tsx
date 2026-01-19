import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Eye, RefreshCw, ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import type { Order, OrderItem } from "@shared/schema";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800",
  preparing: "bg-blue-100 text-blue-800", 
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-800",
};

const statusLabels = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  delivered: "Delivered",
};

export function OrderManagement() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const { data: orders = [], isLoading, refetch } = useQuery<Order[]>({
    queryKey: statusFilter === "all" ? ["/api/orders"] : ["/api/orders", { status: statusFilter }],
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const response = await apiRequest("PATCH", `/api/orders/${orderId}`, { status });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      toast({
        title: "Success",
        description: "Order status updated successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update order status",
        variant: "destructive",
      });
    },
  });

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined) return "$0.00";
    return `$${parseFloat(amount.toString()).toFixed(2)}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    const dateObj = new Date(date);
    // Format in a consistent timezone to avoid UTC conversion issues
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC' // Show in UTC to match database storage
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>Order Management</span>
          </div>
          <div className="flex items-center space-x-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Orders</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="preparing">Preparing</SelectItem>
                <SelectItem value="ready">Ready</SelectItem>
                <SelectItem value="delivered">Delivered</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8">
            <ShoppingCart className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {statusFilter === "all" ? "No orders found" : `No ${statusFilter} orders found`}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Order Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">#{order.orderNumber}</TableCell>
                  <TableCell>
                    {order.customerName || "Walk-in Customer"}
                  </TableCell>
                  <TableCell>{formatCurrency(order.total)}</TableCell>
                  <TableCell>
                    <Select
                      value={order.status}
                      onValueChange={(newStatus) => 
                        updateOrderStatusMutation.mutate({ 
                          orderId: order.id, 
                          status: newStatus 
                        })
                      }
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue>
                          <Badge 
                            className={statusColors[order.status as keyof typeof statusColors]}
                          >
                            {statusLabels[order.status as keyof typeof statusLabels]}
                          </Badge>
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="preparing">Preparing</SelectItem>
                        <SelectItem value="ready">Ready</SelectItem>
                        <SelectItem value="delivered">Delivered</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Badge variant={order.isDelivery ? 'secondary' : 'default'}>
                      {order.isDelivery ? 'Delivery' : 'In-Store'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(order.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                          data-testid={`view-order-${order.id}`}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Order Details #{order.orderNumber}</DialogTitle>
                        </DialogHeader>
                        <ViewOrderDetails order={order} />
                      </DialogContent>
                    </Dialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// View Order Details Component
function ViewOrderDetails({ order }: { order: Order }) {
  const { data: orderItems = [] } = useQuery<OrderItem[]>({
    queryKey: [`/api/orders/${order.id}/items`],
    enabled: !!order.id,
  });

  const formatCurrency = (amount: string | number | null | undefined) => {
    if (amount === null || amount === undefined) return "$0.00";
    return `$${parseFloat(amount.toString()).toFixed(2)}`;
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "N/A";
    const dateObj = new Date(date);
    return dateObj.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Order Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3 className="font-semibold mb-2">Order Information</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Order #:</span> {order.orderNumber}</div>
            <div><span className="font-medium">Customer:</span> {order.customerName}</div>
            {order.customerPhone && (
              <div><span className="font-medium">Phone:</span> {order.customerPhone}</div>
            )}
            <div><span className="font-medium">Status:</span> 
              <Badge className={`ml-2 ${
                order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                order.status === 'ready' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {order.status}
              </Badge>
            </div>
            <div><span className="font-medium">Type:</span> 
              <Badge variant={order.isDelivery ? 'secondary' : 'default'} className="ml-2">
                {order.isDelivery ? 'Delivery' : 'In-Store'}
              </Badge>
            </div>
          </div>
        </div>
        
        <div>
          <h3 className="font-semibold mb-2">Order Details</h3>
          <div className="space-y-2 text-sm">
            <div><span className="font-medium">Created:</span> {formatDate(order.createdAt)}</div>
            <div><span className="font-medium">Subtotal:</span> {formatCurrency(order.subtotal)}</div>
            <div><span className="font-medium">Tax:</span> {formatCurrency(order.tax)}</div>
            <div className="font-semibold text-lg"><span>Total:</span> {formatCurrency(order.total)}</div>
          </div>
        </div>
      </div>

      {/* Order Items */}
      <div>
        <h3 className="font-semibold mb-3">Order Items</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Unit Price</TableHead>
              <TableHead>Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orderItems.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-medium">
                  {item.product?.name || 'Unknown Product'}
                </TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>{formatCurrency(item.unitPrice)}</TableCell>
                <TableCell>{formatCurrency(item.total)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}