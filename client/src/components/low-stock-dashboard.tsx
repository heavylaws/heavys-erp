import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Package, TrendingUp, RefreshCw } from "lucide-react";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface LowStockItem {
  id: string;
  name: string;
  stockQuantity: number | string;
  minThreshold: number | string;
  unit?: string;
  type: 'product' | 'component';
  costPerUnit?: string;
}

interface LowStockData {
  products: LowStockItem[];
  components: LowStockItem[];
}

export function LowStockDashboard() {
  const [activeTab, setActiveTab] = useState<'all' | 'products' | 'components'>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: lowStockData, isLoading, refetch } = useQuery<LowStockData>({
    queryKey: ['/api/inventory/low-stock'],
  });

  const bulkRestockMutation = useMutation({
    mutationFn: async (items: { id: string; type: 'product' | 'component'; quantity: number }[]) => {
      const promises = items.map(item =>
        apiRequest("PATCH", `/api/${item.type === 'product' ? 'products' : 'components'}/${item.id}/stock`, {
          quantityChange: item.quantity,
          reason: "Bulk restock - Low stock alert"
        })
      );
      return Promise.all(promises);
    },
    onSuccess: () => {
      toast({
        title: "Bulk Restock Complete",
        description: "All selected items have been restocked successfully",
      });
      refetch();
    },
    onError: (error: any) => {
      toast({
        title: "Bulk Restock Failed",
        description: error.message || "Failed to restock items",
        variant: "destructive",
      });
    },
  });

  const allItems = [
    ...(lowStockData?.products.map(p => ({ ...p, type: 'product' as const })) || []),
    ...(lowStockData?.components.map(i => ({ ...i, type: 'component' as const })) || [])
  ];

  const filteredItems = activeTab === 'all' ? allItems :
    activeTab === 'products' ? (lowStockData?.products.map(p => ({ ...p, type: 'product' as const })) || []) :
      (lowStockData?.components.map(i => ({ ...i, type: 'component' as const })) || []);

  const getSeverityLevel = (stock: number, threshold: number) => {
    if (stock <= 0) return { level: 'critical', color: 'bg-red-500', text: 'Out of Stock' };
    if (stock <= threshold * 0.5) return { level: 'high', color: 'bg-orange-500', text: 'Very Low' };
    if (stock <= threshold) return { level: 'medium', color: 'bg-yellow-500', text: 'Low Stock' };
    return { level: 'low', color: 'bg-green-500', text: 'Normal' };
  };

  const calculatePotentialLoss = (item: LowStockItem) => {
    if (!item.costPerUnit) return null;
    const cost = parseFloat(item.costPerUnit);
    const currentStock = typeof item.stockQuantity === 'string' ? parseFloat(item.stockQuantity) : item.stockQuantity;
    const threshold = typeof item.minThreshold === 'string' ? parseFloat(item.minThreshold) : item.minThreshold;
    const shortfall = Math.max(0, threshold - currentStock);
    return (cost * shortfall).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading low stock items...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="low-stock-dashboard">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Low Stock Management Dashboard
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('all')}
                data-testid="tab-all"
              >
                All Items ({allItems.length})
              </Button>
              <Button
                variant={activeTab === 'products' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('products')}
                data-testid="tab-products"
              >
                Products ({lowStockData?.products.length || 0})
              </Button>
              <Button
                variant={activeTab === 'components' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('components')}
                data-testid="tab-components"
              >
                Components ({lowStockData?.components.length || 0})
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                data-testid="button-refresh"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No low stock items found</p>
              <p className="text-sm">All inventory levels are adequate!</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Current Stock</TableHead>
                  <TableHead>Threshold</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Est. Loss</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const currentStock = typeof item.stockQuantity === 'string' ? parseFloat(item.stockQuantity) : item.stockQuantity;
                  const threshold = typeof item.minThreshold === 'string' ? parseFloat(item.minThreshold) : item.minThreshold;
                  const severity = getSeverityLevel(currentStock, threshold);
                  const potentialLoss = calculatePotentialLoss(item);

                  return (
                    <TableRow key={`${item.type}-${item.id}`}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>
                        <Badge variant={item.type === 'product' ? 'default' : 'secondary'}>
                          {item.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {currentStock} {item.unit || 'units'}
                      </TableCell>
                      <TableCell>{threshold} {item.unit || 'units'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${severity.color}`} />
                          <span className="text-sm">{severity.text}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {potentialLoss ? `$${potentialLoss}` : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <StockAdjustmentDialog
                          item={{
                            id: item.id,
                            name: item.name,
                            stockQuantity: item.stockQuantity,
                            unit: item.unit,
                            type: item.type
                          }}
                        >
                          <Button variant="outline" size="sm" data-testid={`button-adjust-${item.id}`}>
                            <TrendingUp className="h-4 w-4 mr-1" />
                            Restock
                          </Button>
                        </StockAdjustmentDialog>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}