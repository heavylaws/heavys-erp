import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bell, AlertTriangle, Package, TrendingDown, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

interface InventoryNotification {
  id: string;
  type: 'low_stock' | 'out_of_stock' | 'stock_update';
  productName: string;
  currentStock: number;
  threshold: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high';
}

interface InventoryNotificationsProps {
  className?: string;
}

export function InventoryNotifications({ className }: InventoryNotificationsProps) {
  const [notifications, setNotifications] = useState<InventoryNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const { toast } = useToast();

  // Fetch low stock items
  const { data: lowStockData, refetch } = useQuery<{ products: any[]; ingredients: any[]; }>({
    queryKey: ['/api/inventory/low-stock'],
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  // Convert low stock data to notifications
  useEffect(() => {
    if (lowStockData) {
      const newNotifications: InventoryNotification[] = [];
      
      // Add product notifications
      lowStockData.products.forEach((product) => {
        const severity = product.stockQuantity === 0 ? 'high' : 
                        product.stockQuantity <= Math.ceil(product.minThreshold * 0.5) ? 'medium' : 'low';
        
        newNotifications.push({
          id: `product-${product.id}`,
          type: product.stockQuantity === 0 ? 'out_of_stock' : 'low_stock',
          productName: product.name,
          currentStock: product.stockQuantity,
          threshold: product.minThreshold,
          timestamp: new Date(),
          severity
        });
      });

      // Add ingredient notifications
      lowStockData.ingredients.forEach((ingredient) => {
        const severity = ingredient.currentStock === 0 ? 'high' : 
                        ingredient.currentStock <= Math.ceil(ingredient.minThreshold * 0.5) ? 'medium' : 'low';
        
        newNotifications.push({
          id: `ingredient-${ingredient.id}`,
          type: ingredient.currentStock === 0 ? 'out_of_stock' : 'low_stock',
          productName: `${ingredient.name} (Ingredient)`,
          currentStock: ingredient.currentStock,
          threshold: ingredient.minThreshold,
          timestamp: new Date(),
          severity
        });
      });

      setNotifications(newNotifications);

      // Show toast for critical notifications
      const criticalNotifications = newNotifications.filter(n => n.severity === 'high');
      if (criticalNotifications.length > 0) {
        toast({
          title: "Critical Inventory Alert",
          description: `${criticalNotifications.length} item(s) are out of stock!`,
          variant: "destructive",
        });
      }
    }
  }, [lowStockData, toast]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'bg-red-500';
      case 'medium': return 'bg-orange-500';
      case 'low': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'out_of_stock': return <AlertTriangle className="h-4 w-4" />;
      case 'low_stock': return <TrendingDown className="h-4 w-4" />;
      case 'stock_update': return <Package className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

  const criticalCount = notifications.filter(n => n.severity === 'high').length;
  const totalCount = notifications.length;

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setShowNotifications(!showNotifications)}
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {totalCount > 0 && (
          <Badge 
            variant={criticalCount > 0 ? "destructive" : "secondary"} 
            className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {totalCount}
          </Badge>
        )}
      </Button>

      {showNotifications && (
        <Card className="absolute top-full right-0 mt-2 w-80 z-50 shadow-lg">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-sm">Inventory Alerts</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Navigate to inventory tab with low stock focus
                  const inventoryTab = document.querySelector('[data-value="inventory"]') as HTMLElement;
                  if (inventoryTab) {
                    inventoryTab.click();
                    // Scroll to low stock dashboard after tab switch
                    setTimeout(() => {
                      const lowStockDashboard = document.querySelector('[data-testid="low-stock-dashboard"]');
                      if (lowStockDashboard) {
                        lowStockDashboard.scrollIntoView({ behavior: 'smooth' });
                      }
                    }, 100);
                  }
                  setShowNotifications(false);
                }}
                className="h-6 w-6 p-0"
                title="View Low Stock Items"
                data-testid="button-view-low-stock"
              >
                <ExternalLink className="h-3 w-3" />
              </Button>
            </div>
            
            {notifications.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className="flex items-start space-x-2 p-2 bg-gray-50 rounded-lg"
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 ${getSeverityColor(notification.severity)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-1">
                        {getNotificationIcon(notification.type)}
                        <span className="text-sm font-medium truncate">
                          {notification.productName}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {notification.type === 'out_of_stock' 
                          ? 'Out of stock!' 
                          : `${notification.currentStock} left (min: ${notification.threshold})`
                        }
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">All inventory levels are good!</p>
              </div>
            )}

            <div className="mt-3 pt-2 border-t">
              <div className="text-xs text-gray-500 text-center">
                Updates every 30 seconds • Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}