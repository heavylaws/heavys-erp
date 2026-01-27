import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { CurrencyRate } from '@shared/schema';
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Truck, Route, LogOut, ShoppingCart, Plus, Minus, User, Star, Search, X, Scan } from "lucide-react";
import { useMobileOptimizations } from "@/components/mobile-optimizations";
import { ShiftButton } from "@/components/shift-button";
import type { Order, Product } from "@shared/schema";
import { useState, useEffect, useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { formatDualCurrency } from "@shared/currency-utils";
import { ProductSearch } from "@/components/product-search";
import { BarcodeInput } from "@/components/barcode-input";
import { BarcodeScanner } from "@/components/barcode-scanner";

interface CartItem {
  productId: string;
  productName: string;
  price: number;
  quantity: number;
  notes?: string;
}

export default function CourierScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'orders' | 'delivery'>('orders');
  const [orderSearchTerm, setOrderSearchTerm] = useState('');
  const { data: ingredients = [] } = useQuery<any[]>({
    queryKey: ['/api/ingredients']
  });

  const getRecipeBasedStock = (product: any) => {
    if (product.type !== 'ingredient_based' || !Array.isArray(product.recipeIngredients) || product.recipeIngredients.length === 0) return product.stockQuantity;
    const ingredientMap = Object.fromEntries((ingredients as any[]).map((i: any) => [i.id, parseFloat(i.stockQuantity)]));
    let minUnits = Infinity;
    for (const ri of product.recipeIngredients) {
      const available = ingredientMap[ri.ingredientId] || 0;
      const needed = parseFloat(ri.quantity);
      if (needed > 0) {
        minUnits = Math.min(minUnits, Math.floor(available / needed));
      }
    }
    return isFinite(minUnits) ? minUnits : 0;
  };

  const getAvailableStock = (product: any) => (product.type === 'ingredient_based' ? getRecipeBasedStock(product) : product.stockQuantity);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      window.location.href = '/';
    } catch (error) {
      window.location.href = '/';
    }
  };

  // Initialize mobile optimizations
  useMobileOptimizations();

  // Order taking state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [isDelivery, setIsDelivery] = useState(false);
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card'>('cash');
  const [selectedCategory, setSelectedCategory] = useState<string>("");

  // WebSocket for real-time notifications
  useWebSocket((message) => {
    if (message.type === 'order_ready' && message.data) {
      toast({
        title: "🔔 Order Ready!",
        description: `Order #${message.data.orderNumber} is ready for delivery`,
        variant: "default",
      });
    }
  });

  // Redirect if not authorized (Authentication is handled by App.tsx)
  useEffect(() => {
    if (!isLoading && user && !['admin', 'courier'].includes((user as any).role)) {
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

  // Fetch categories for filtering
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['/api/categories'],
  });

  // Fetch products for order taking with category filtering
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  // Filter products by selected category
  const products = selectedCategory
    ? allProducts.filter(product => product.categoryId === selectedCategory)
    : allProducts;

  // Fetch current exchange rate for dual currency display
  const { data: currentRate } = useQuery<CurrencyRate | null>({
    queryKey: ['/api/currency/current']
  });
  const numericCurrentRate = currentRate?.rate ? parseFloat(currentRate.rate) : undefined;

  // Fetch ready orders for delivery
  const { data: allReadyOrders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders/ready'],
    queryFn: async () => {
      const response = await fetch('/api/orders?status=ready', { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Failed to fetch ready orders');
      }
      return response.json();
    }
  });

  // Smart search filter for delivery orders
  const readyOrders = useMemo(() => {
    if (!allReadyOrders || !orderSearchTerm) return allReadyOrders;

    const searchLower = orderSearchTerm.toLowerCase();
    return allReadyOrders.filter(order =>
      order.orderNumber?.toString().includes(searchLower) ||
      order.customerName?.toLowerCase().includes(searchLower) ||
      order.customerPhone?.toLowerCase().includes(searchLower) ||
      order.customerAddress?.toLowerCase().includes(searchLower) ||
      order.id.toLowerCase().includes(searchLower)
    );
  }, [allReadyOrders, orderSearchTerm]);

  // Fetch orders in delivery
  const { data: allOrders = [] } = useQuery<Order[]>({
    queryKey: ['/api/orders'],
  });

  const inProgressDeliveries = allOrders.filter(
    order => order.status === 'delivered' && order.courierId === (user as any)?.id
  );

  const deliveredToday = allOrders.filter(
    order => order.status === 'delivered' &&
      order.courierId === (user as any)?.id &&
      order.deliveredAt &&
      new Date(order.deliveredAt).toDateString() === new Date().toDateString()
  ).length;

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(orderData)
      });

      if (!response.ok) {
        throw new Error('Failed to create order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setNotes('');
      toast({
        title: "Order Created",
        description: "Order submitted successfully to kitchen!",
      });
    },
  });

  // Update order mutation for delivery
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, status, courierId }: { orderId: string; status: string; courierId?: string }) => {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ status, courierId })
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      return response.json();
    },
    onSuccess: () => {
      // Invalidate both queries to refresh the UI immediately
      queryClient.invalidateQueries({ queryKey: ['/api/orders/ready'] });
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
    },
  });

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.productId === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        productId: product.id,
        productName: product.name,
        price: parseFloat(product.price),
        quantity: 1
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find(item => item.productId === productId);
    if (existing && existing.quantity > 1) {
      setCart(cart.map(item =>
        item.productId === productId
          ? { ...item, quantity: item.quantity - 1 }
          : item
      ));
    } else {
      setCart(cart.filter(item => item.productId !== productId));
    }
  };

  const getCartTotal = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.08; // 8% tax
    return {
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + tax).toFixed(2)
    };
  };

  const handleSubmitOrder = () => {
    if (cart.length === 0) {
      toast({
        title: "Empty Cart",
        description: "Please add items to cart before submitting",
        variant: "destructive",
      });
      return;
    }

    const totals = getCartTotal();
    const orderData = {
      customerName: customerName || null,
      customerPhone: customerPhone || null,
      customerAddress: customerAddress || null,
      isDelivery,
      paymentMethod,
      notes: notes || null,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price.toString(),
        notes: item.notes || null
      }))
    };

    createOrderMutation.mutate(orderData);
  };

  const pickupOrder = (orderId: string) => {
    const order = readyOrders.find(o => o.id === orderId);
    updateOrderMutation.mutate({
      orderId,
      status: order?.isDelivery ? 'delivering' : 'delivered',
      courierId: (user as any)?.id
    });
    toast({
      title: "Order Picked Up",
      description: order?.isDelivery ? "Order is now out for delivery." : "Order has been completed.",
    });
  };

  const completeDelivery = (orderId: string) => {
    updateOrderMutation.mutate({ orderId, status: 'delivered' });
    toast({
      title: "Delivery Complete",
      description: "Order has been delivered successfully.",
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="bg-purple-600 p-2 rounded-lg">
              <User className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral">Courier / Receptionist</h1>
              <p className="text-sm text-gray-600">Order Taking & Delivery</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              <Star className="h-4 w-4 mr-2 inline" />
              {deliveredToday} delivered today
            </div>
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

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="flex space-x-8 px-6">
          <button
            onClick={() => setActiveTab('orders')}
            className={`py-4 px-2 border-b-2 font-medium text-sm ${activeTab === 'orders'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <ShoppingCart className="h-4 w-4 mr-2 inline" />
            Take Orders
          </button>
          <button
            onClick={() => setActiveTab('delivery')}
            className={`py-4 px-2 border-b-2 font-medium text-sm ${activeTab === 'delivery'
                ? 'border-purple-500 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
          >
            <Truck className="h-4 w-4 mr-2 inline" />
            Delivery ({readyOrders.length})
          </button>
        </div>
      </div>

      <div className="p-6">
        {activeTab === 'orders' ? (
          /* ORDER TAKING SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Products Menu */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Menu Items
                  <Badge variant="outline" className="text-xs">
                    {products.length} items
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Barcode Input with Inactivity Timer */}
                <div className="mb-4">
                  <div className="flex space-x-2">
                    <div className="flex-1">
                      <BarcodeInput
                        products={allProducts}
                        onProductAdd={addToCart}
                        autoFocus={true}
                        placeholder="Scan barcode to add item..."
                        inactivityTimeout={3000}
                      />
                    </div>
                    <BarcodeScanner
                      onBarcodeScanned={(barcode) => {
                        const product = allProducts.find(p => p.barcode === barcode);
                        if (product) addToCart(product);
                      }}
                      trigger={
                        <Button variant="outline" size="sm" className="whitespace-nowrap">
                          <Scan className="h-4 w-4 mr-2" />
                          Camera
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Search Bar */}
                <div className="mb-4">
                  <ProductSearch
                    products={allProducts}
                    onProductSelect={addToCart}
                    currentRate={numericCurrentRate}
                  />
                </div>

                {/* Category Filters */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Categories</div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => setSelectedCategory("")}
                      variant={selectedCategory === "" ? "default" : "outline"}
                      size="sm"
                      className="text-xs"
                      data-testid="courier-category-all"
                    >
                      All Items
                    </Button>
                    {categories.map((category: any) => (
                      <Button
                        key={category.id}
                        onClick={() => setSelectedCategory(category.id)}
                        variant={selectedCategory === category.id ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        data-testid={`courier-category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {category.name}
                      </Button>
                    ))}
                  </div>
                  {selectedCategory && (
                    <div className="mt-2">
                      <Badge variant="secondary" className="text-xs">
                        Filtered by: {categories.find((c: any) => c.id === selectedCategory)?.name}
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Products Grid */}
                <div className="max-h-80 overflow-y-auto">
                  {products.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      {selectedCategory ? (
                        <p className="text-sm">No products in this category</p>
                      ) : (
                        <p className="text-sm">No products available</p>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {products.map((product) => (
                        <div
                          key={product.id}
                          className="flex flex-col justify-between p-3 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors"
                          data-testid={`courier-product-${product.id}`}
                        >
                          <div className="space-y-1">
                            <h3 className="font-medium text-sm leading-tight line-clamp-2 min-h-[2.2rem]">{product.name}</h3>
                            <p className="text-xs text-gray-600">
                              {currentRate && (currentRate as any).rate ?
                                formatDualCurrency(parseFloat(product.price), parseFloat((currentRate as any).rate)) :
                                `$${product.price}`
                              }
                            </p>
                            <p className="text-[10px] text-gray-500">
                              Stock: {getAvailableStock(product) <= product.minThreshold ? (
                                <Badge variant="destructive" className="text-[10px] ml-1">
                                  {getAvailableStock(product)} left!
                                </Badge>
                              ) : (
                                getAvailableStock(product)
                              )}
                            </p>
                            {/* Barcode suppressed from UI */}
                          </div>
                          <Button
                            onClick={() => addToCart(product)}
                            disabled={getAvailableStock(product) === 0}
                            size="sm"
                            className="mt-2"
                            data-testid={`courier-add-product-${product.id}`}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Cart & Customer Info */}
            <div className="space-y-6">
              {/* Cart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Current Order
                    <Badge>{cart.length} items</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {cart.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No items in cart</p>
                  ) : (
                    <>
                      {cart.map((item) => (
                        <div key={item.productId} className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{item.productName}</span>
                            <p className="text-sm text-gray-600">${item.price} each</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Button
                              onClick={() => removeFromCart(item.productId)}
                              size="sm"
                              variant="outline"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            <span className="mx-2">{item.quantity}</span>
                            <Button
                              onClick={() => addToCart({
                                id: item.productId,
                                name: item.productName,
                                price: item.price.toString()
                              } as Product)}
                              size="sm"
                              variant="outline"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="border-t pt-4 space-y-2">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span>${getCartTotal().subtotal}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Tax (8%):</span>
                          <span>${getCartTotal().tax}</span>
                        </div>
                        <div className="flex justify-between font-bold">
                          <span>Total:</span>
                          <span>${getCartTotal().total}</span>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Customer Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Customer Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="customerName">Customer Name</Label>
                      <Input
                        id="customerName"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder="Enter name (optional)"
                      />
                    </div>
                    <div>
                      <Label htmlFor="customerPhone">Phone Number</Label>
                      <Input
                        id="customerPhone"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Enter phone (optional)"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <input
                      type="checkbox"
                      id="isDelivery"
                      checked={isDelivery}
                      onChange={(e) => setIsDelivery(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="isDelivery">Delivery Order</Label>
                  </div>

                  {isDelivery && (
                    <div>
                      <Label htmlFor="customerAddress">Delivery Address</Label>
                      <Textarea
                        id="customerAddress"
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="Enter delivery address"
                        rows={2}
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="paymentMethod">Payment Method</Label>
                    <Select value={paymentMethod} onValueChange={(value: 'cash' | 'card') => setPaymentMethod(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Order Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Any special instructions..."
                      rows={2}
                    />
                  </div>

                  <Button
                    onClick={handleSubmitOrder}
                    disabled={cart.length === 0 || createOrderMutation.isPending}
                    className="w-full"
                  >
                    {createOrderMutation.isPending ? "Submitting..." : "Submit Order"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* DELIVERY SECTION */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Ready for Delivery */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Ready for Delivery
                  <Badge className="bg-green-600 text-white">
                    {readyOrders.length} orders
                  </Badge>
                </CardTitle>

                {/* Smart Search for Delivery Orders */}
                <div className="mt-4">
                  <Label htmlFor="delivery-search">Search Orders</Label>
                  <div className="relative mt-2">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="delivery-search"
                      placeholder="Search by order #, customer name, phone, address..."
                      value={orderSearchTerm}
                      onChange={(e) => setOrderSearchTerm(e.target.value)}
                      className="pl-10"
                      data-testid="input-delivery-search"
                    />
                    {orderSearchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setOrderSearchTerm('')}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                        data-testid="button-clear-delivery-search"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {orderSearchTerm && allReadyOrders && (
                    <div className="mt-2">
                      <Badge variant="outline" className="bg-blue-50">
                        Showing {readyOrders.length} of {allReadyOrders.length} orders
                      </Badge>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 max-h-96 overflow-y-auto">
                {readyOrders.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No orders ready for delivery</p>
                ) : (
                  readyOrders.map((order) => (
                    <div key={order.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-lg font-bold text-neutral">
                            #{order.orderNumber}
                          </span>
                          <span className="text-sm text-gray-600">
                            Ready at {order.readyAt ? formatTime(order.readyAt.toString()) : 'N/A'}
                          </span>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Ready</Badge>
                      </div>

                      <div className="mb-4">
                        <div className="flex items-start space-x-3">
                          <User className="text-gray-400 mt-1 h-4 w-4" />
                          <div>
                            <p className="font-medium text-neutral">
                              {order.customerName || 'Walk-in Customer'}
                            </p>
                            {order.isDelivery && (
                              <p className="text-sm text-gray-600">
                                📍 {order.customerAddress || 'Address not provided'}
                              </p>
                            )}
                            <p className="text-sm text-gray-600">
                              📞 {order.customerPhone || 'No phone provided'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm text-gray-600">
                          Total: <span className="font-bold text-neutral">${order.total}</span>
                        </span>
                        <span className="text-sm text-gray-600">
                          {order.isDelivery ? 'Delivery' : 'Pickup'}
                        </span>
                      </div>

                      <Button
                        onClick={() => pickupOrder(order.id)}
                        className="w-full bg-purple-600 text-white hover:bg-purple-700"
                        disabled={updateOrderMutation.isPending}
                      >
                        <Route className="h-4 w-4 mr-2" />
                        {order.isDelivery ? 'Start Delivery' : 'Mark as Pickup'}
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* Delivery Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Today's Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{deliveredToday}</div>
                    <div className="text-sm text-gray-600">Delivered Today</div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">4.8</div>
                    <div className="text-sm text-gray-600">Average Rating</div>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600">18</div>
                    <div className="text-sm text-gray-600">Avg Delivery (min)</div>
                  </div>
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">24.8</div>
                    <div className="text-sm text-gray-600">Total Distance (mi)</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}