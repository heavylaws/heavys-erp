import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, DollarSign, Save, Send } from "lucide-react";
import type { Product } from "@shared/schema";

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
}

interface OrderPanelProps {
  activeOrders: CurrentOrder[];
  currentOrderId: string;
  onOrderChange: (orderId: string) => void;
  onNewOrder: () => void;
  onQuantityChange: (productId: string, change: number) => void;
  onPayment: (method: "cash") => void;
  onSendToBarista?: () => void;
  onSaveOrder: () => void;
  isProcessing?: boolean;
}

export function OrderPanel({
  activeOrders,
  currentOrderId,
  onOrderChange,
  onNewOrder,
  onQuantityChange,
  onPayment,
  onSendToBarista,
  onSaveOrder,
  isProcessing = false
}: OrderPanelProps) {
  const currentOrder = activeOrders.find(order => order.id === currentOrderId);

  return (
    <div className="w-1/3 bg-white border-l border-gray-200 flex flex-col">
      {/* Order Tabs */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-neutral">Current Orders</h2>
          <Button onClick={onNewOrder} size="sm" className="touch-target">
            <Plus className="h-4 w-4 mr-2" />
            New Order
          </Button>
        </div>
        
        {activeOrders.length > 0 && (
          <Tabs value={currentOrderId} onValueChange={onOrderChange}>
            <TabsList className="grid w-full grid-cols-auto overflow-x-auto">
              {activeOrders.map((order, index) => (
                <TabsTrigger
                  key={order.id}
                  value={order.id}
                  className="text-sm touch-target"
                >
                  Order #{index + 1}
                  {order.items.length > 0 && (
                    <Badge variant="secondary" className="ml-2 text-xs">
                      {order.items.length}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value={currentOrderId}>
              {/* Content is managed below using currentOrder */}
            </TabsContent>
          </Tabs>
        )}
      </div>

      {/* Order Items */}
      <div className="flex-1 p-4 overflow-y-auto">
        {!currentOrder || currentOrder.items.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <DollarSign className="h-12 w-12 mx-auto" />
            </div>
            <p className="text-gray-500">No items in current order</p>
            <p className="text-sm text-gray-400 mt-2">Add products to get started</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentOrder.items.map((item) => (
              <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-neutral truncate">{item.product?.name}</h4>
                  {item.modifications && (
                    <p className="text-sm text-gray-600 truncate">{item.modifications}</p>
                  )}
                  <p className="text-xs text-gray-500">${item.unitPrice.toFixed(2)} each</p>
                </div>
                <div className="flex items-center space-x-3 ml-4">
                  <div className="flex items-center space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuantityChange(item.productId, -1)}
                      className="h-8 w-8 p-0 touch-target"
                      disabled={isProcessing}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-medium">{item.quantity}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onQuantityChange(item.productId, 1)}
                      className="h-8 w-8 p-0 touch-target"
                      disabled={isProcessing}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <span className="font-bold text-primary w-16 text-right">
                    ${item.total.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Summary & Payment */}
      {currentOrder && currentOrder.items.length > 0 && (
        <div className="border-t border-gray-200 p-4">
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-gray-600">Subtotal:</span>
              <span className="font-medium">${currentOrder.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tax (8.5%):</span>
              <span className="font-medium">${currentOrder.tax.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t pt-2">
              <span>Total:</span>
              <span className="text-primary">${currentOrder.total.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-3">
            <Button
              onClick={() => onPayment("cash")}
              className="w-full py-4 bg-secondary text-white hover:bg-green-700 touch-target"
              disabled={isProcessing}
            >
              <DollarSign className="h-5 w-5 mr-2" />
              {isProcessing ? "Processing..." : "Cash Payment"}
            </Button>
            {onSendToBarista && (
              <Button
                onClick={onSendToBarista}
                className="w-full py-4 touch-target"
                disabled={isProcessing}
              >
                <Send className="h-5 w-5 mr-2" />
                {isProcessing ? "Sending..." : "Send to Barista"}
              </Button>
            )}
            <Button
              onClick={onSaveOrder}
              variant="outline"
              className="w-full py-3 touch-target"
              disabled={isProcessing}
            >
              <Save className="h-5 w-5 mr-2" />
              Save Order
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
