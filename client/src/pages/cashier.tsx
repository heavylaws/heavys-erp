import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useWebSocket } from "@/hooks/useWebSocket";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { CurrencyRate } from '@shared/schema';
import { apiRequest } from "@/lib/queryClient";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";


import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TutorialManager } from "@/components/tutorial-manager";
import { Coffee, LogOut, Plus, Minus, DollarSign, Save, CheckCircle, Edit, Trash2, Printer, Send, Grid, List } from "lucide-react";
import type { Product, Category, Order } from "@shared/schema";
import { formatDualCurrency, convertUsdToLbp } from "@shared/currency-utils";
import { ProductSearch } from "@/components/product-search";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { BarcodeInput } from "@/components/barcode-input";
import { InventoryNotifications } from "@/components/inventory-notifications";
import { ShiftManagement } from "@/components/shift-management";
import { ShiftButton } from "@/components/shift-button";
import { ShiftSummary } from "@/components/shift-summary";
import { ReceiptSettingsDialog } from "@/components/receipt-settings-dialog";
import { ReceiptSettings, type CompanySettings } from "@shared/schema";
import { printReceipt as sendToPrinter } from "@/lib/printer-api";
import { InvoiceTemplate, useInvoiceGenerator } from "@/components/invoice-template";
import { FileText } from "lucide-react";

interface OrderItem {
  id?: string;
  productId: string;
  product?: Product;
  quantity: number;
  unitPrice: number;
  total: number;
  modifications?: string;
}

interface CurrentOrder {
  id: string;
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  originalOrderId?: string; // For tracking edited orders
}

export default function CashierPOS() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentTime, setCurrentTime] = useState(new Date());
  // Compact grid view for product tiles — shows more products at once
  const [compactView, setCompactView] = useState<boolean>(() => {
    try {
      const persisted = localStorage.getItem('cashier.compactView');
      if (persisted === 'true' || persisted === 'false') return persisted === 'true';
      // If not persisted, default to compact on larger screens (more columns) or mobile
      if (typeof window !== 'undefined') {
        return window.innerWidth >= 1280 ? true : false;
      }
      return false;
    } catch (e) {
      return false;
    }
  });
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [activeOrders, setActiveOrders] = useState<CurrentOrder[]>([]);
  const [currentOrderId, setCurrentOrderId] = useState<string>("");
  const [autoSendToFulfillmentOnCash, setAutoSendToFulfillmentOnCash] = useState<boolean>(false);
  const [showShiftSummary, setShowShiftSummary] = useState(false);
  const [completedShift, setCompletedShift] = useState<any>(null);

  // Invoice state
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const { createInvoiceFromOrder } = useInvoiceGenerator();

  const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/settings/company'] });
  const companyName = settings?.name || "Highway Cafe";

  // Company info for invoices (Using dynamic settings)
  const companyInfo = {
    name: settings?.name || "Highway Cafe",
    address: settings?.address || "123 Business Rd, Commerce City",
    phone: settings?.phone || "+1 (555) 123-4567",
    email: settings?.email || "billing@heavys.com",
    taxId: settings?.taxId || "TAX-12345678"
  };

  useWebSocket((message) => {
    if (message.type === 'order_update' || message.type === 'ORDER_UPDATE') {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
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

  const handleShiftComplete = (shift: any) => {
    setCompletedShift(shift);
    setShowShiftSummary(true);
  };

  // Redirect if not authorized (Authentication is handled by App.tsx)
  useEffect(() => {
    if (!isLoading && user && !['admin', 'cashier'].includes((user as any).role)) {
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

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Inactivity-based price refresh (30 seconds)
  // Only refreshes when cashier is idle AND has no items in current order
  useEffect(() => {
    let inactivityTimer: NodeJS.Timeout;
    const INACTIVITY_TIMEOUT = 30 * 1000; // 30 seconds

    const currentOrder = activeOrders.find(o => o.id === currentOrderId);
    const hasItemsInOrder = currentOrder && currentOrder.items.length > 0;

    const resetTimer = () => {
      clearTimeout(inactivityTimer);
      if (!hasItemsInOrder) {
        inactivityTimer = setTimeout(() => {
          // Refresh products and prices after inactivity
          queryClient.invalidateQueries({ queryKey: ['/api/products'] });
          queryClient.invalidateQueries({ queryKey: ['/api/components'] });
          console.log('[Cashier] Prices refreshed after 30s inactivity');
        }, INACTIVITY_TIMEOUT);
      }
    };

    // Reset timer on user activity
    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, resetTimer));
    resetTimer(); // Start the timer

    return () => {
      clearTimeout(inactivityTimer);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [currentOrderId, activeOrders, queryClient]);

  // Initialize with first order
  useEffect(() => {
    if (activeOrders.length === 0) {
      createNewOrder();
    }
  }, []);

  // Fetch categories
  const { data: categories = [] } = useQuery<any[]>({
    queryKey: ['/api/categories']
  });

  // Fetch receipt settings
  const { data: receiptSettings } = useQuery<ReceiptSettings>({
    queryKey: ['/api/settings/receipt'],
  });

  // Fetch full product catalog once, then filter locally for category tabs
  const { data: allProducts = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const response = await fetch('/api/products', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorizedError();
          return [];
        }
        throw new Error('Failed to fetch products');
      }
      return response.json();
    }
  });

  const filteredProducts = useMemo(() => {
    if (!selectedCategory) {
      return allProducts;
    }
    return allProducts.filter((product) => product.categoryId === selectedCategory);
  }, [allProducts, selectedCategory]);

  useEffect(() => {
    try {
      localStorage.setItem('cashier.compactView', compactView ? 'true' : 'false');
    } catch (e) {
      // ignore storage errors
    }
    // Persist to server for per-user settings
    (async () => {
      try {
        await fetch('/api/users/me/settings', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ compactView }),
        });
      } catch (e) {
        // ignore server error; leave local storage fallback
      }
    })();
  }, [compactView]);

  // Persist toggle setting for auto send-to-fulfillment on cash
  useEffect(() => {
    (async () => {
      try {
        await fetch('/api/users/me/settings', {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoSendToFulfillmentOnCash }),
        });
      } catch (e) {
        // ignore server errors; UI is allowed to fallback to local variable
      }
    })();
  }, [autoSendToFulfillmentOnCash]);

  // On mount, fetch the settings from server and override local preference
  useEffect(() => {
    (async () => {
      try {
        const response = await fetch('/api/users/me/settings', { credentials: 'include' });
        if (response.ok) {
          const settings = await response.json();
          if (typeof settings?.compactView === 'boolean') {
            setCompactView(settings.compactView);
          }
          if (typeof settings?.autoSendToFulfillmentOnCash === 'boolean') {
            setAutoSendToFulfillmentOnCash(settings.autoSendToFulfillmentOnCash);
          }
        }
      } catch (_e) {
        // ignore server errors - retain local fallback
      }
    })();
  }, []);

  // Fetch current exchange rate for dual currency display
  const { data: currentRate } = useQuery<CurrencyRate | null>({
    queryKey: ['/api/currency/current']
  });
  const numericCurrentRate = currentRate?.rate ? parseFloat(currentRate.rate) : undefined;

  // Fetch pending orders for payment processing (with items included)
  const { data: pendingOrders = [] } = useQuery({
    queryKey: ['/api/orders', { status: 'pending' }],
    queryFn: async () => {
      const response = await fetch('/api/orders?status=pending&include_items=true', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorizedError();
          return [];
        }
        throw new Error('Failed to fetch pending orders');
      }
      return response.json();
    }
  });

  // Fetch ready orders for pickup/handoff (with items included)
  const { data: readyOrders = [] } = useQuery({
    queryKey: ['/api/orders', { status: 'ready' }],
    queryFn: async () => {
      const response = await fetch('/api/orders?status=ready&include_items=true', { credentials: 'include' });
      if (!response.ok) {
        if (response.status === 401) {
          handleUnauthorizedError();
          return [];
        }
        throw new Error('Failed to fetch ready orders');
      }
      return response.json();
    }
  });

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: { order: any; items: any[] }) => {
      const response = await apiRequest('POST', '/api/orders', orderData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
      toast({
        title: "Order Processed",
        description: "Order has been successfully created.",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError();
        return;
      }
      toast({
        title: "Error",
        description: "Failed to process order. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Update order mutation for payments and send-to-barista updates
  const updateOrderMutation = useMutation({
    mutationFn: async ({ orderId, paymentMethod, sentToFulfillment, status }: { orderId: string; paymentMethod?: string; sentToFulfillment?: boolean, status?: string }) => {
      const body: any = {};
      if (paymentMethod) {
        body.paymentMethod = paymentMethod;
        body.status = 'preparing';
      }
      if (status) {
        body.status = status;
      }
      if (typeof sentToFulfillment === 'boolean') {
        body.sentToFulfillment = sentToFulfillment;
      }

      const response = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error('Failed to update order');
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/components'] });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError();
        return;
      }
      toast({
        title: "Update Error",
        description: "Failed to update order. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleUnauthorizedError = () => {
    // Authentication is handled by App.tsx; no need to redirect here.
    console.warn('Unauthorized error detected by query/mutation handler');
  };

  const createNewOrder = () => {
    const newOrderId = `order-${Date.now()}`;
    const newOrder: CurrentOrder = {
      id: newOrderId,
      items: [],
      subtotal: 0,
      tax: 0,
      total: 0,
    };
    setActiveOrders(prev => [...prev, newOrder]);
    setCurrentOrderId(newOrderId);
  };

  const getCurrentOrder = () => {
    return activeOrders.find(order => order.id === currentOrderId);
  };

  const updateCurrentOrder = (updater: (order: CurrentOrder) => CurrentOrder) => {
    setActiveOrders(prev => prev.map(order =>
      order.id === currentOrderId ? updater(order) : order
    ));
  };

  // Calculate available stock for display (actual stock minus items in all active carts)
  // For component-based products, we don't track product-level stock, so we return a high number to allow addition
  const getAvailableStock = (product: Product) => {
    if (product.type === 'component_based') return 9999;

    let reservedQuantity = 0;
    const actualStock = Number(product.stockQuantity);

    // Sum up quantities from all active orders (carts)
    activeOrders.forEach(order => {
      const item = order.items.find(item => item.productId === product.id);
      if (item) {
        reservedQuantity += item.quantity;
      }
    });

    return Math.max(0, actualStock - reservedQuantity);
  };

  const calculateOrderTotals = (items: OrderItem[]) => {
    const total = items.reduce((sum, item) => sum + item.total, 0);
    // Prices already include tax, so subtotal and total are the same
    return { subtotal: total, tax: 0, total };
  };

  const addToOrder = (product: Product) => {
    // Check if product is available before adding
    const availableStock = getAvailableStock(product);
    const currentQuantityInOrder = getCurrentOrder()?.items.find(item => item.productId === product.id)?.quantity || 0;

    if (availableStock <= currentQuantityInOrder) {
      toast({
        title: "Out of Stock",
        description: `${product.name} is not available. Current stock: ${availableStock}`,
        variant: "destructive",
      });
      return;
    }

    updateCurrentOrder(order => {
      const existingItem = order.items.find(item => item.productId === product.id);

      let newItems;
      if (existingItem) {
        newItems = order.items.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1, total: (item.quantity + 1) * item.unitPrice }
            : item
        );
      } else {
        const newItem: OrderItem = {
          productId: product.id,
          product,
          quantity: 1,
          unitPrice: parseFloat(product.price),
          total: parseFloat(product.price),
        };
        newItems = [...order.items, newItem];
      }

      const totals = calculateOrderTotals(newItems);
      return { ...order, items: newItems, ...totals };
    });
  };

  const updateItemQuantity = (productId: string, change: number) => {
    updateCurrentOrder(order => {
      const newItems = order.items.map(item => {
        if (item.productId === productId) {
          const newQuantity = Math.max(0, item.quantity + change);
          if (newQuantity === 0) {
            return null; // Mark for removal
          }
          return { ...item, quantity: newQuantity, total: newQuantity * item.unitPrice };
        }
        return item;
      }).filter(item => item !== null) as OrderItem[]; // Remove null items

      const totals = calculateOrderTotals(newItems);
      return { ...order, items: newItems, ...totals };
    });
  };

  const processPayment = async (paymentMethod: string) => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder || currentOrder.items.length === 0) return;

    // Check if order effectively requires technician attention
    // Check if order effectively requires technician attention
    const hasTechnicianItems = currentOrder.items.some(item => item.product?.requiresFulfillment);
    // Auto-send if it's Cash and either the toggle is ON OR it explicitly contains technician items
    const shouldSendToFulfillment = (paymentMethod === 'cash' && (!!autoSendToFulfillmentOnCash || hasTechnicianItems));

    const orderData = {
      subtotal: currentOrder.total.toFixed(2), // Tax-inclusive pricing
      tax: "0.00", // No separate tax line
      total: currentOrder.total.toFixed(2),
      paymentMethod,
      status: 'preparing', // Changed from 'pending' to 'preparing' for immediate kitchen processing
      isDelivery: false,
    };

    const items = currentOrder.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
      modifications: item.modifications,
    }));

    try {
      // Check if this is an edited order
      const isEditedOrder = (currentOrder as any).originalOrderId;
      if (isEditedOrder) {
        // For edited orders, update the existing order instead of creating new
        const updateData = {
          ...orderData,
          status: 'preparing'
        };

        await apiRequest('PUT', `/api/orders/${(currentOrder as any).originalOrderId}`, {
          order: updateData,
          items
        });
        // If we should auto-send to fulfillment, mark the existing order as sent after the update
        if (shouldSendToFulfillment) {
          markOrderSentToFulfillment((currentOrder as any).originalOrderId);
          toast({ title: "Order Sent to Fulfillment", description: "Order has been auto-sent to fulfillment after payment." });
        }

        toast({
          title: "Order Updated",
          description: "The edited order has been processed and sent to kitchen.",
        });
      } else {
        // Regular new order
        const createdOrder = await createOrderMutation.mutateAsync({ order: orderData, items });
        // If setting is enabled, mark this newly created order as sent to fulfillment
        if (shouldSendToFulfillment && createdOrder?.id) {
          markOrderSentToFulfillment(createdOrder.id);
          toast({ title: "Order Sent to Fulfillment", description: "Order has been auto-sent to fulfillment after payment." });
        }
      }

      // Update active shift if user has one
      try {
        await apiRequest('POST', '/api/shifts/update-sales', {
          amount: parseFloat(currentOrder.total.toFixed(2)),
          paymentMethod
        });
      } catch (error) {
        // Shift update failed, but don't block order processing
        console.warn('Failed to update shift sales:', error);
      }

      // Remove current order and create new one
      setActiveOrders(prev => prev.filter(order => order.id !== currentOrderId));
      createNewOrder();
    } catch (error) {
      console.error('Payment processing failed:', error);
      toast({
        title: "Payment Failed",
        description: "There was an error processing the payment. Please try again.",
        variant: "destructive"
      });
    }
  };

  const saveOrder = () => {
    // Implementation for saving order for later
    toast({
      title: "Order Saved",
      description: "Order has been saved for later processing.",
    });
  };

  // Process payment for existing pending orders
  const processOrderPayment = async (orderId: string, paymentMethod: string, orderTotal: number) => {
    // Process the payment
    // Decide whether to send to fulfillment. Only auto-send for cash payments when the setting is enabled
    const shouldSendToFulfillment = paymentMethod === 'cash' && !!autoSendToFulfillmentOnCash;
    updateOrderMutation.mutate({ orderId, paymentMethod });
    if (shouldSendToFulfillment) {
      // After marking the order as paid, also mark it as sent to fulfillment
      markOrderSentToFulfillment(orderId);
      toast({ title: "Order Sent to Fulfillment", description: "Order has been auto-sent to fulfillment after payment." });
    }

    // Update active shift if user has one
    try {
      await apiRequest('POST', '/api/shifts/update-sales', {
        amount: orderTotal,
        paymentMethod
      });
    } catch (error) {
      // Shift update failed, but don't block order processing
      console.warn('Failed to update shift sales:', error);
    }
  };

  // Save edited order without payment processing
  const saveEditedOrder = async () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder || currentOrder.items.length === 0) return;

    const items = currentOrder.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
      modifications: item.modifications,
    }));

    try {
      // Update the existing order with new items and totals
      await apiRequest('PUT', `/api/orders/${(currentOrder as any).originalOrderId}`, {
        order: {
          subtotal: currentOrder.subtotal.toFixed(2),
          tax: currentOrder.tax.toFixed(2),
          total: currentOrder.total.toFixed(2),
          // Keep original status - don't change it during editing
        },
        items
      });

      // Remove the edit order and refresh orders list
      setActiveOrders(prev => prev.filter(order => order.id !== currentOrderId));
      createNewOrder();
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });

      toast({
        title: "Order Updated",
        description: "Changes have been saved to the order.",
      });
    } catch (error) {
      console.error('Save edit failed:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving the changes. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Send current order to fulfillment without processing payment
  const markOrderSentToFulfillment = (orderId: string) => {
    updateOrderMutation.mutate({ orderId, sentToFulfillment: true });
  };

  const sendCurrentOrderToFulfillment = async () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder || currentOrder.items.length === 0) return;

    // First create a normal order (status pending), then flag it as sentToFulfillment
    const baseOrderData = {
      subtotal: currentOrder.total.toFixed(2),
      tax: "0.00",
      total: currentOrder.total.toFixed(2),
      status: 'pending',
      isDelivery: false,
    } as any;

    const items = currentOrder.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice.toFixed(2),
      total: item.total.toFixed(2),
      modifications: item.modifications,
    }));

    try {
      const isEditedOrder = (currentOrder as any).originalOrderId;

      // If editing an existing order, just patch it with sentToFulfillment
      if (isEditedOrder) {
        markOrderSentToFulfillment((currentOrder as any).originalOrderId);
      } else {
        const createdOrder = await createOrderMutation.mutateAsync({ order: baseOrderData, items });

        // After successful creation, flag it as sent to fulfillment
        if (createdOrder?.id) {
          markOrderSentToFulfillment(createdOrder.id);
        }
      }

      toast({
        title: "Order Sent to Fulfillment",
        description: "The order has been sent to fulfillment.",
      });

      setActiveOrders(prev => prev.filter(order => order.id !== currentOrderId));
      createNewOrder();
    } catch (error) {
      console.error('Send to fulfillment failed:', error);
      toast({
        title: "Send Failed",
        description: "There was an error sending the order to fulfillment. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Edit courier order functionality
  const editCourierOrder = (order: any) => {
    // First check if this order is already being edited
    const existingEditId = `edit-${order.id}-${Date.now()}`;
    const alreadyEditing = activeOrders.find(ao => ao.id.startsWith(`edit-${order.id}`));

    if (alreadyEditing) {
      setCurrentOrderId(alreadyEditing.id);
      toast({
        title: "Order Already Being Edited",
        description: "Switched to the existing edit session for this order.",
      });
      return;
    }

    // Convert the pending order into a current order for editing
    const editableOrder = {
      id: existingEditId,
      originalOrderId: order.id, // Keep track of the original order ID
      items: order.items?.map((item: any) => ({
        productId: item.productId,
        product: item.product || { id: item.productId, name: 'Unknown Item', price: item.unitPrice },
        quantity: item.quantity,
        unitPrice: parseFloat(item.unitPrice),
        total: parseFloat(item.total),
        modifications: item.modifications
      })) || [],
      subtotal: parseFloat(order.subtotal || order.total) / 1.085,
      tax: parseFloat(order.total || 0) * 0.085 / 1.085,
      total: parseFloat(order.total || 0),
    } as CurrentOrder;

    // Add to active orders and switch to it
    setActiveOrders(prev => [...prev, editableOrder]);
    setCurrentOrderId(editableOrder.id);

    toast({
      title: "Order Loaded for Editing",
      description: `Order #${order.orderNumber} is now being edited. Make changes and process payment when ready.`,
    });
  };

  // Delete courier order
  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      await apiRequest('DELETE', `/api/orders/${orderId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({
        title: "Order Deleted",
        description: "The order has been successfully deleted."
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        handleUnauthorizedError();
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete order. Please try again.",
        variant: "destructive"
      });
    }
  });

  const printReceipt = async (order: any) => {
    try {
      const formattedItems = order.items.map((item: any) => ({
        name: item.product?.name || 'Unknown Item',
        quantity: item.quantity,
        total: item.total
      }));

      const receiptData = {
        storeName: settings?.name || receiptSettings?.businessName || 'Highway Cafe',
        address: settings?.address || receiptSettings?.address || '',
        phone: settings?.phone || receiptSettings?.phone || '',
        orderId: order.orderNumber || order.id,
        timestamp: order.createdAt || new Date(),
        items: formattedItems,
        subtotal: parseFloat(order.total),
        tax: 0,
        total: parseFloat(order.total),
        paymentMethod: order.paymentMethod || 'CASH',
        cashReceived: 0,
        change: 0
      };

      await sendToPrinter(receiptData);

      toast({
        title: "Printing...",
        description: "Receipt sent to printer.",
      });
    } catch (error: any) {
      console.error('Print failed:', error);
      toast({
        title: "Print Failed",
        description: error.message || "Unknown printer error",
        variant: "destructive"
      });
    }
  };

  const handleCreateInvoice = () => {
    const currentOrder = getCurrentOrder();
    if (!currentOrder) return;

    // Convert CurrentOrder to format expected by invoice generator
    const invoiceOrder = {
      items: currentOrder.items.map(item => ({
        ...item,
        name: item.product?.name,
        price: item.unitPrice,
        product: {
          ...item.product,
          sku: item.product?.sku
        }
      })),
      paymentMethod: 'Pending',
      notes: ''
    };

    const invoiceData = createInvoiceFromOrder(invoiceOrder, {
      name: (currentOrder as any).customerName || 'Walk-in Customer',
      phone: (currentOrder as any).customerPhone,
      address: (currentOrder as any).deliveryAddress
    });

    setViewingInvoice(invoiceData);
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

  const currentOrder = getCurrentOrder();

  // Show shift summary if shift completed
  if (showShiftSummary && completedShift && user) {
    return (
      <ShiftSummary
        currentUser={user as any}
        completedShift={completedShift}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 cashier-interface">
      {/* Tutorial Manager */}
      <TutorialManager
        userRole="cashier"
        onTutorialComplete={(tutorialId) => {
          toast({
            title: "Tutorial Completed!",
            description: `Great job completing the "${tutorialId}" tutorial.`,
          });
        }}
      />

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center space-x-4">
            <div className="bg-primary p-2 rounded-lg">
              <Coffee className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral">Highway Cafe POS</h1>
              <p className="text-sm text-gray-600">Cashier Terminal</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-lg font-semibold text-neutral">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div className="text-sm text-gray-600">
                {currentTime.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
            </div>

            {user && (
              <ShiftButton
                currentUser={user as any}
                onShiftComplete={handleShiftComplete}
                onLogout={handleLogout}
              />
            )}

            <ReceiptSettingsDialog />

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

      <div className="flex h-[calc(100vh-80px)]">
        {/* Product Categories & Items */}
        <div className="w-2/3 p-4 overflow-y-auto">
          {/* Barcode input + Search Bar */}
          <div className="mb-6 space-y-4">
            <BarcodeInput
              products={allProducts}
              onProductAdd={addToOrder}
              autoFocus={true}
              placeholder="Scan barcode to add item..."
              inactivityTimeout={5000}
              className="w-full"
            />
            <ProductSearch
              products={allProducts}
              onProductSelect={addToOrder}
              currentRate={numericCurrentRate}
            />
          </div>

          {/* Category Tabs */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="text-sm font-medium text-gray-600">Product Categories</div>
                <Badge variant="outline" className="text-xs">
                  {filteredProducts.length} products shown
                </Badge>
                <div className="border-l pl-3 ml-3">
                  <Button
                    onClick={() => setCompactView(!compactView)}
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    title={compactView ? 'Switch to Normal View' : 'Switch to Compact View'}
                    data-testid="toggle-compact-view"
                  >
                    {compactView ? <Grid className="h-3.5 w-3.5 mr-1" /> : <List className="h-3.5 w-3.5 mr-1" />}
                    {compactView ? 'Normal View' : 'Compact Mode'}
                  </Button>
                </div>
              </div>
            </div>
            {/* Category Tabs - moved inside mb-4 or keep outside? Original was inside. */}
            {/* Category Tabs */}
            <div className="flex space-x-2 overflow-x-auto" role="tablist">
              <Button
                onClick={() => setSelectedCategory("")}
                variant={selectedCategory === "" ? "default" : "outline"}
                className="whitespace-nowrap"
                data-testid="category-all-products"
              >
                All Products
              </Button>
              {categories.map((category) => (
                <Button
                  key={category.id}
                  data-category={category.name}
                  onClick={() => setSelectedCategory(category.id)}
                  variant={selectedCategory === category.id ? "default" : "outline"}
                  className="whitespace-nowrap"
                  data-testid={`category-${category.name.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  {category.name}
                </Button>
              ))}
            </div>
            {selectedCategory && (
              <div className="mt-2">
                <Badge variant="secondary" className="text-xs">
                  Filtered by: {categories.find(c => c.id === selectedCategory)?.name}
                </Badge>
              </div>
            )}
          </div>

          {/* Product Grid */}
          <div className={`grid product-grid ${compactView ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'}`}>
            {filteredProducts.map((product) => (
              <Card
                key={product.id}
                className={`cursor-pointer hover:shadow-md transition-shadow product-card ${compactView ? 'compact-card' : ''} ${getAvailableStock(product) === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                onClick={() => addToOrder(product)}
              >
                <CardContent className={compactView ? 'p-2' : 'p-4'}>
                  <div className={`${compactView ? 'aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center p-1 relative overflow-hidden' : 'aspect-square bg-gray-100 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden'}`}>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.parentElement?.querySelector('.placeholder-icon')?.classList.remove('hidden');
                        }}
                      />
                    ) : (
                      <Coffee className={`${compactView ? 'h-5 w-5 text-gray-400' : 'h-8 w-8 text-gray-400'}`} />
                    )}
                    {/* Fallback icon that shows if image fails to load */}
                    {product.imageUrl && (
                      <Coffee className={`placeholder-icon hidden absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${compactView ? 'h-5 w-5 text-gray-400' : 'h-8 w-8 text-gray-400'}`} />
                    )}
                  </div>
                  {compactView ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <h3
                          title={product.name}
                          className={`font-semibold text-neutral mb-1 text-sm`}
                        >
                          {product.name}
                        </h3>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        <div className="font-medium">{product.name}</div>
                        <div className="text-xs text-gray-500 mt-1">
                          {currentRate && (currentRate as any).rate ?
                            formatDualCurrency(parseFloat(product.price), parseFloat((currentRate as any).rate)) :
                            `$${product.price}`
                          }
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <h3
                      title={product.name}
                      className={`font-semibold text-neutral mb-1 ${compactView ? 'text-sm truncate' : ''}`}
                    >
                      {product.name}
                    </h3>
                  )}
                  {!compactView && <p className="text-sm text-gray-600 mb-1">{product.description}</p>}
                  {/* In compact view we hide the barcode under the name and show the name on two justified lines; show barcode only in normal view */}
                  {/* Barcode removed from UI per request - preserved in DB and edit dialogs */}
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex flex-col">
                        <span className={`${compactView ? 'compact-price' : 'text-lg'} font-bold text-primary`}>
                          {currentRate && (currentRate as any).rate ?
                            formatDualCurrency(parseFloat(product.price), parseFloat((currentRate as any).rate)) :
                            `$${product.price}`
                          }
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 stock-indicator">
                        {(() => {
                          if (product.type === 'component_based') {
                            return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Bundle Item</Badge>;
                          }

                          const availableStock = getAvailableStock(product);
                          const isLowStock = availableStock <= product.minThreshold;
                          const isOutOfStock = availableStock === 0;

                          if (isOutOfStock) {
                            return <Badge variant="destructive" className="out-of-stock-alert">Out of Stock!</Badge>;
                          } else if (isLowStock) {
                            return <Badge variant="destructive" className="low-stock-alert">{Math.floor(availableStock)} left!</Badge>;
                          } else {
                            return `${Math.floor(availableStock)} available`;
                          }
                        })()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Order Panel */}
        <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col order-panel">
          {/* Main Tabs */}
          <div className="border-b border-gray-200 p-4">
            <Tabs defaultValue="new-order" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="new-order">New Order</TabsTrigger>
                <TabsTrigger value="pending-orders">
                  Pending
                  {pendingOrders.length > 0 && (
                    <Badge variant="destructive" className="ml-1">{pendingOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ready-orders">
                  Ready
                  {readyOrders.length > 0 && (
                    <Badge className="ml-1 bg-green-600 hover:bg-green-700">{readyOrders.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="shift-management">Shift</TabsTrigger>
              </TabsList>

              <TabsContent value="new-order" className="mt-4">
                {/* Current Orders Section */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-neutral">Current Orders</h2>
                  <Button onClick={createNewOrder} size="sm" className="new-order-btn">
                    <Plus className="h-4 w-4 mr-2" />
                    New Order
                  </Button>
                </div>

                <Tabs value={currentOrderId} onValueChange={setCurrentOrderId}>
                  <TabsList className="grid w-full grid-cols-auto overflow-x-auto order-tabs">
                    {activeOrders.map((order, index) => (
                      <TabsTrigger key={`order-tab-${order.id}`} value={order.id} className="text-sm order-tab">
                        {(order as any).originalOrderId ? `Edit Order #${index + 1}` : `Order #${index + 1}`}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </TabsContent>

              <TabsContent value="pending-orders" className="mt-4">
                <div className="text-sm font-medium text-gray-600 mb-4">
                  Orders awaiting payment ({pendingOrders.length})
                </div>

                {/* Pending Orders List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pendingOrders.map((order: any) => (
                    <Card key={order.id} className="border border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold">Order #{order.orderNumber}</div>
                            <div className="text-sm text-gray-600">
                              {order.customerName || 'Walk-in Customer'}
                            </div>
                            {order.customerPhone && (
                              <div className="text-sm text-gray-500">
                                {order.customerPhone}
                              </div>
                            )}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">${parseFloat(order.total).toFixed(2)}</div>
                            <Badge variant="outline" className="mt-1">
                              {order.isDelivery ? 'Delivery' : 'Pickup'}
                            </Badge>
                          </div>
                        </div>

                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                          <div className="mb-3">
                            <div className="text-sm font-medium mb-2">Items:</div>
                            <div className="space-y-1">
                              {order.items.map((item: any) => (
                                <div key={item.id} className="text-sm flex justify-between">
                                  <span>{item.quantity}x {item.product?.name || 'Item'}</span>
                                  <span className="text-xs">
                                    {currentRate && (currentRate as any).rate ?
                                      formatDualCurrency(parseFloat(item.total), parseFloat((currentRate as any).rate)) :
                                      `$${parseFloat(item.total).toFixed(2)}`
                                    }
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Action Buttons */}
                        <div className="space-y-2">
                          {/* Edit and Delete Buttons */}
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => editCourierOrder(order)}
                              variant="outline"
                              className="flex-1"
                              disabled={updateOrderMutation.isPending || deleteOrderMutation.isPending}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              onClick={() => {
                                if (window.confirm('Are you sure you want to delete this order? This cannot be undone.')) {
                                  deleteOrderMutation.mutate(order.id);
                                }
                              }}
                              variant="outline"
                              className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
                              disabled={updateOrderMutation.isPending || deleteOrderMutation.isPending}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              Delete
                            </Button>
                          </div>

                          {/* Payment / Send Buttons */}
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => processOrderPayment(order.id, 'cash', parseFloat(order.total))}
                              className="flex-1 bg-secondary text-white hover:bg-green-700"
                              disabled={updateOrderMutation.isPending || deleteOrderMutation.isPending}
                            >
                              <DollarSign className="h-4 w-4 mr-1" />
                              Cash
                            </Button>
                            <Button
                              onClick={() => updateOrderMutation.mutate({ orderId: order.id, sentToFulfillment: true })}
                              className="flex-1"
                              disabled={updateOrderMutation.isPending || deleteOrderMutation.isPending}
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Send to Fulfillment
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {pendingOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <CheckCircle className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <div>No pending orders</div>
                      <div className="text-sm">All orders have been processed</div>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="ready-orders" className="mt-4">
                <div className="text-sm font-medium text-gray-600 mb-4">
                  Orders ready for pickup ({readyOrders.length})
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {readyOrders.map((order: any) => (
                    <Card key={order.id} className="border border-green-200 bg-green-50">
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <div className="font-semibold text-lg">Order #{order.orderNumber}</div>
                              <Badge className="bg-green-600">Ready</Badge>
                            </div>
                            <div className="text-sm text-gray-600">
                              {order.customerName || 'Walk-in Customer'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-lg">${parseFloat(order.total).toFixed(2)}</div>
                          </div>
                        </div>

                        {/* Order Items */}
                        {order.items && order.items.length > 0 && (
                          <div className="mb-3">
                            <div className="space-y-1">
                              {order.items.map((item: any) => (
                                <div key={item.id} className="text-sm flex justify-between">
                                  <span>{item.quantity}x {item.product?.name || 'Item'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            updateOrderMutation.mutate(
                              { orderId: order.id, status: 'delivered' },
                              {
                                onError: (error) => {
                                  toast({
                                    title: "Failed to Mark Delivered",
                                    description: error.message || "Unknown error occurred",
                                    variant: "destructive"
                                  });
                                }
                              }
                            );
                          }}
                          disabled={updateOrderMutation.isPending}
                        >
                          <CheckCircle className="h-4 w-4 mr-2" />
                          {updateOrderMutation.isPending ? "Updating..." : "Mark Delivered / Picked Up"}
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                  {readyOrders.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-sm">No orders ready for pickup</div>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Dynamic Content Area - New Orders or Payment Summary */}
          <div className="flex-1 flex flex-col">
            <Tabs defaultValue="new-order" className="flex-1 flex flex-col">
              <TabsContent value="new-order" className="flex-1 flex flex-col">
                <div className="flex-1 p-4 overflow-y-auto">
                  {/* Header Row */}
                  <div className="flex items-center text-xs font-semibold text-gray-500 mb-2 px-2">
                    <div className="w-16 text-center">Qty</div>
                    <div className="flex-1 px-2">Item</div>
                    <div className="w-16 text-right">Unit</div>
                    <div className="w-32 text-right">Total</div>
                  </div>

                  <div className="space-y-2">
                    {currentOrder?.items.map((item) => (
                      <div key={item.productId} className="flex flex-col bg-gray-50 rounded-lg p-2 text-sm">
                        <div className="flex items-center justify-between">
                          {/* Qty Controls */}
                          <div className="flex items-center w-16 justify-center space-x-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateItemQuantity(item.productId, -1)}
                              className="h-6 w-6 p-0 hover:bg-gray-200"
                            >
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="font-medium text-center w-4">{item.quantity}</span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateItemQuantity(item.productId, 1)}
                              className="h-6 w-6 p-0 hover:bg-gray-200"
                            >
                              <Plus className="h-3 w-3" />
                            </Button>
                          </div>

                          {/* Item Name */}
                          <div className="flex-1 px-2 truncate font-medium text-neutral" title={item.product?.name}>
                            {item.product?.name}
                            {item.modifications && <div className="text-[10px] text-gray-500 font-normal truncate">{item.modifications}</div>}
                          </div>

                          {/* Unit Price */}
                          <div className="w-16 text-right text-gray-600">
                            ${item.unitPrice.toFixed(2)}
                          </div>

                          {/* Total Price */}
                          <div className="w-32 text-right font-bold text-primary text-xs">
                            {currentRate && (currentRate as any).rate ?
                              <div className="flex flex-col items-end">
                                <span>{formatDualCurrency(item.total, parseFloat((currentRate as any).rate)).split(' (')[0]}</span>
                                <span className="text-gray-500 font-normal">
                                  {formatDualCurrency(item.total, parseFloat((currentRate as any).rate)).split(' (')[1]?.replace(')', '')}
                                </span>
                              </div> :
                              `$${item.total.toFixed(2)}`
                            }
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary & Payment */}
                {currentOrder && (
                  <div className="border-t border-gray-200 p-4">
                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-lg font-bold border-t pt-2 order-total">
                        <span>Total (tax included):</span>
                        <span className="text-primary text-base">
                          {currentRate && (currentRate as any).rate ?
                            formatDualCurrency(currentOrder.total, parseFloat((currentRate as any).rate)) :
                            `$${currentOrder.total.toFixed(2)}`
                          }
                        </span>
                      </div>
                    </div>

                    <div className="space-y-3 payment-section">
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-600">Auto send to fulfillment on cash</div>
                        <Switch
                          checked={autoSendToFulfillmentOnCash}
                          onCheckedChange={(val: boolean) => setAutoSendToFulfillmentOnCash(!!val)}
                        />
                      </div>
                      {/* Show different buttons for editing vs new orders */}
                      {(currentOrder as any).originalOrderId ? (
                        // Edit mode buttons
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={saveEditedOrder}
                            className="py-4 bg-secondary text-white hover:bg-green-700"
                            disabled={currentOrder.items.length === 0 || createOrderMutation.isPending}
                          >
                            <CheckCircle className="h-5 w-5 mr-2" />
                            Save Edit
                          </Button>
                          <Button
                            onClick={() => {
                              // Cancel edit and remove the edit order
                              setActiveOrders(prev => prev.filter(order => order.id !== currentOrderId));
                              createNewOrder();
                              toast({
                                title: "Edit Cancelled",
                                description: "Changes have been discarded.",
                              });
                            }}
                            variant="outline"
                            className="py-4 text-red-600 border-red-200 hover:bg-red-50"
                            disabled={createOrderMutation.isPending}
                          >
                            <Minus className="h-5 w-5 mr-2" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        // New order payment buttons
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={() => processPayment('cash')}
                            className="py-4 bg-secondary text-white hover:bg-green-700"
                            disabled={currentOrder.items.length === 0 || createOrderMutation.isPending}
                          >
                            <DollarSign className="h-5 w-5 mr-2" />
                            Cash
                          </Button>
                          <Button
                            onClick={sendCurrentOrderToFulfillment}
                            className="py-4"
                            disabled={currentOrder.items.length === 0 || createOrderMutation.isPending}
                          >
                            <Send className="h-5 w-5 mr-2" />
                            Send to Fulfillment
                          </Button>
                        </div>
                      )}

                      {/* Bottom row - Save/Preview for new orders only */}
                      {!(currentOrder as any).originalOrderId && (
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            onClick={saveOrder}
                            variant="outline"
                            className="py-3"
                            disabled={currentOrder.items.length === 0}
                          >
                            <Save className="h-5 w-5 mr-2" />
                            Save Order
                          </Button>
                          <Button
                            onClick={() => {
                              // Create a preview order object for printing receipt from current order
                              const previewOrder = {
                                id: currentOrder.id,
                                orderNumber: `PREVIEW-${Date.now()}`,
                                customerName: 'Walk-in Customer',
                                customerPhone: '',
                                isDelivery: false,
                                deliveryAddress: '',
                                total: currentOrder.total.toString(),
                                paymentMethod: 'pending',
                                items: currentOrder.items,
                                createdAt: new Date().toISOString()
                              };
                              printReceipt(previewOrder);
                            }}
                            variant="outline"
                            className="py-3"
                            disabled={currentOrder.items.length === 0}
                          >
                            <Printer className="h-5 w-5 mr-2" />
                            Preview Receipt
                          </Button>
                          <Button
                            onClick={handleCreateInvoice}
                            variant="outline"
                            className="py-3 text-blue-600 border-blue-200 hover:bg-blue-50 col-span-2 mt-2"
                            disabled={currentOrder.items.length === 0}
                          >
                            <FileText className="h-5 w-5 mr-2" />
                            Print A4 Invoice
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="shift-management" className="mt-4">
                <div className="flex flex-col h-full">
                  <h3 className="text-lg font-semibold mb-4">Shift Management</h3>
                  <div className="flex-1 overflow-auto">
                    {user && <ShiftManagement currentUser={user as any} />}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {viewingInvoice && (
        <InvoiceTemplate
          invoice={viewingInvoice}
          company={companyInfo}
          onClose={() => setViewingInvoice(null)}
        />
      )}
    </div >
  );
}
