import { useState, ReactNode } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Minus, Package, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface StockItem {
  id: string;
  name: string;
  stockQuantity: number | string;
  unit?: string;
  type: 'product' | 'component';
  productType?: 'finished_good' | 'component_based';
}

interface StockAdjustmentDialogProps {
  item: StockItem;
  children: ReactNode;
}

export function StockAdjustmentDialog({ item, children }: StockAdjustmentDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [adjustment, setAdjustment] = useState({
    type: 'add' as 'add' | 'subtract' | 'set',
    quantity: '',
    reason: ''
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const stockAdjustmentMutation = useMutation({
    mutationFn: async (data: typeof adjustment) => {
      let quantityChange = parseInt(data.quantity);

      if (data.type === 'subtract') {
        quantityChange = -quantityChange;
      } else if (data.type === 'set') {
        const currentStock = typeof item.stockQuantity === 'string'
          ? parseFloat(item.stockQuantity)
          : item.stockQuantity;
        quantityChange = quantityChange - currentStock;
      }

      const endpoint = item.type === 'product'
        ? `/api/products/${item.id}/stock`
        : `/api/components/${item.id}/stock`;

      const res = await apiRequest("PATCH", endpoint, {
        quantityChange,
        reason: data.reason || `Stock adjustment: ${data.type} ${data.quantity}`
      });
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Stock Updated",
        description: `${item.name} stock has been successfully adjusted`,
      });
      setIsOpen(false);
      setAdjustment({ type: 'add', quantity: '', reason: '' });

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['/api/inventory/low-stock'] });
      queryClient.invalidateQueries({ queryKey: [`/api/${item.type}s`] });
    },
    onError: (error: any) => {
      toast({
        title: "Stock Adjustment Failed",
        description: error.message || "Failed to adjust stock",
        variant: "destructive",
      });
    },
  });

  const calculateNewStock = () => {
    if (!adjustment.quantity) return null;

    const currentStock = typeof item.stockQuantity === 'string'
      ? parseFloat(item.stockQuantity)
      : item.stockQuantity;
    const adjustmentQty = parseInt(adjustment.quantity);

    switch (adjustment.type) {
      case 'add':
        return currentStock + adjustmentQty;
      case 'subtract':
        return Math.max(0, currentStock - adjustmentQty);
      case 'set':
        return adjustmentQty;
      default:
        return currentStock;
    }
  };

  const getAdjustmentTypeColor = (type: string) => {
    switch (type) {
      case 'add': return 'text-green-600 bg-green-50';
      case 'subtract': return 'text-red-600 bg-red-50';
      case 'set': return 'text-blue-600 bg-blue-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const isValidAdjustment = () => {
    if (!adjustment.quantity || parseInt(adjustment.quantity) <= 0) return false;

    if (adjustment.type === 'subtract') {
      const currentStock = typeof item.stockQuantity === 'string'
        ? parseFloat(item.stockQuantity)
        : item.stockQuantity;
      return parseInt(adjustment.quantity) <= currentStock;
    }

    return true;
  };

  const newStock = calculateNewStock();

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Adjust Stock - {item.name}
          </DialogTitle>
          <DialogDescription>
            Make stock adjustments and track inventory changes.
          </DialogDescription>
        </DialogHeader>

        {item.productType === 'component_based' ? (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-semibold mb-1">Bundle-Based Product</p>
              <p>
                This product's stock is managed automatically based on its ingredients.
                You should restock the individual ingredients instead.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {/* Current Stock Display */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Current Stock:</span>
                  <Badge variant="outline" className="font-mono">
                    {item.stockQuantity} {item.unit || 'units'}
                  </Badge>
                </div>
              </div>

              {/* Adjustment Type */}
              <div>
                <Label htmlFor="adjustment-type">Adjustment Type</Label>
                <Select
                  value={adjustment.type}
                  onValueChange={(value: 'add' | 'subtract' | 'set') =>
                    setAdjustment(prev => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger data-testid="select-adjustment-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add">
                      <div className="flex items-center gap-2">
                        <Plus className="h-4 w-4 text-green-500" />
                        Add to Stock
                      </div>
                    </SelectItem>
                    <SelectItem value="subtract">
                      <div className="flex items-center gap-2">
                        <Minus className="h-4 w-4 text-red-500" />
                        Remove from Stock
                      </div>
                    </SelectItem>
                    <SelectItem value="set">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        Set Exact Amount
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Quantity Input */}
              <div>
                <Label htmlFor="adjustment-quantity">
                  {adjustment.type === 'set' ? 'New Stock Amount' : 'Quantity to Adjust'}
                </Label>
                <Input
                  id="adjustment-quantity"
                  type="number"
                  min="1"
                  value={adjustment.quantity}
                  onChange={(e) => setAdjustment(prev => ({ ...prev, quantity: e.target.value }))}
                  placeholder={adjustment.type === 'set' ? 'Enter new stock amount' : 'Enter quantity'}
                  data-testid="input-adjustment-quantity"
                />
              </div>

              {/* Preview Calculation */}
              {newStock !== null && (
                <div className={`p-3 rounded-lg ${getAdjustmentTypeColor(adjustment.type)}`}>
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">New Stock Level:</span>
                    <Badge className="font-mono bg-white text-gray-900">
                      {newStock} {item.unit || 'units'}
                    </Badge>
                  </div>
                  {adjustment.type === 'subtract' && newStock < (typeof item.stockQuantity === 'string' ? parseFloat(item.stockQuantity) : item.stockQuantity) && (
                    <div className="flex items-center gap-1 mt-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      This will reduce stock levels
                    </div>
                  )}
                </div>
              )}

              {/* Reason for Adjustment */}
              <div>
                <Label htmlFor="adjustment-reason">Reason for Adjustment (Optional)</Label>
                <Textarea
                  id="adjustment-reason"
                  value={adjustment.reason}
                  onChange={(e) => setAdjustment(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="e.g., Received new shipment, damaged goods, inventory count correction..."
                  className="resize-none"
                  rows={2}
                  data-testid="textarea-adjustment-reason"
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => stockAdjustmentMutation.mutate(adjustment)}
                disabled={!isValidAdjustment() || stockAdjustmentMutation.isPending || (item as any).productType === 'component_based'}
                data-testid="button-confirm-adjustment"
              >
                {stockAdjustmentMutation.isPending ? 'Updating...' : 'Confirm Adjustment'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}