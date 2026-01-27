import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Coffee, Package, Box, Trash2, Plus, Settings, Search, X } from "lucide-react";
import { BundleManager } from "@/components/bundle-manager";
import type { Product, Component } from "@shared/schema";
import { EditComponentDialog } from "@/components/edit-component-dialog";
import { RestockDialog } from "@/components/restock-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { BarcodePrintDialog } from "@/components/barcode-print-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface InventoryTableProps {
  lowStockData?: {
    products: any[];
    components: any[];
  };
  showComponentsOnly?: boolean;
  showAllInventory?: boolean;
  showLowStockOnly?: boolean;
  onToggleLowStock?: (value: boolean) => void;
}

export function InventoryTable({ lowStockData, showComponentsOnly = false, showAllInventory = false, showLowStockOnly = false, onToggleLowStock }: InventoryTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all products when showing full inventory
  const { data: allProductsData = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: showAllInventory && !showComponentsOnly,
  });

  // Fetch all components 
  const { data: allComponentsData = [], isLoading: componentsLoading } = useQuery<Component[]>({
    queryKey: ["/api/components"],
    enabled: showComponentsOnly || showAllInventory,
  });

  // Filter out bundle-based products from inventory display since they're tracked via components
  // Only show finished goods in inventory - bundle-based items are monitored through their component consumption
  const finishedGoodsOnly = showAllInventory && !showComponentsOnly ?
    allProductsData :
    showComponentsOnly ? [] :
      (lowStockData?.products || []).filter((product: any) => product.type === 'finished_good');

  // Apply filtering
  let rawProducts = finishedGoodsOnly;
  let rawComponents = showAllInventory || showComponentsOnly ? allComponentsData :
    (lowStockData?.components || []);

  if (showLowStockOnly) {
    if (showAllInventory) {
      // If showing all inventory, we need to manually filter for low stock
      rawProducts = rawProducts.filter((p: any) => p.stockQuantity <= p.minThreshold);
      rawComponents = rawComponents.filter((i: any) => parseFloat(i.stockQuantity) <= parseFloat(i.minThreshold));
    }
    // If not showing all inventory (i.e. we are in low stock view mode implicitly or otherwise), 
    // the data passed in might already be low stock data, but let's be safe.
  }

  // Smart search filtering
  const allProducts = useMemo(() => {
    if (!rawProducts || !searchTerm) return rawProducts;

    const searchLower = searchTerm.toLowerCase();
    return rawProducts.filter((product: any) =>
      product.name.toLowerCase().includes(searchLower) ||
      (product.description && product.description.toLowerCase().includes(searchLower)) ||
      (product.barcode && product.barcode.toLowerCase().includes(searchLower))
    );
  }, [rawProducts, searchTerm]);

  const allComponents = useMemo(() => {
    if (!rawComponents || !searchTerm) return rawComponents;

    const searchLower = searchTerm.toLowerCase();
    return rawComponents.filter((component: any) =>
      component.name.toLowerCase().includes(searchLower) ||
      (component.unit && component.unit.toLowerCase().includes(searchLower))
    );
  }, [rawComponents, searchTerm]);

  // ... existing delete mutation ...

  const deleteComponentMutation = useMutation({
    mutationFn: async (componentId: string) => {
      const response = await apiRequest("DELETE", `/api/components/${componentId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/components"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: "Component deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete component. It may be used in bundles.",
        variant: "destructive",
        duration: 3000
      });
    },
  });

  const getStockStatusBadge = (current: number, threshold: number) => {
    if (current <= threshold) {
      return <Badge variant="destructive">Low Stock</Badge>;
    }
    return <Badge className="bg-green-100 text-green-800">Good</Badge>;
  };

  const isLoading = (showAllInventory && (productsLoading || componentsLoading)) ||
    (showComponentsOnly && componentsLoading);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 rounded mb-2"></div>
          ))}
        </div>
      </div>
    );
  }

  const totalItems = allProducts.length + allComponents.length;

  if (totalItems === 0 && !searchTerm && !showLowStockOnly) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No inventory items found</p>
        <p className="text-sm text-gray-500 mt-2">
          {showComponentsOnly ? "Add components to start tracking inventory" : "Add products and components to manage your inventory"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
        {(rawProducts.length > 0 || rawComponents.length > 0 || searchTerm || showLowStockOnly) && (
          <div className="w-full sm:w-auto flex-1">
            <Label htmlFor="inventory-search" className="sr-only">Search Inventory</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="inventory-search"
                placeholder={
                  showComponentsOnly
                    ? "Search components..."
                    : "Search inventory items..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-inventory-search"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  data-testid="button-clear-inventory-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Low Stock Filter Toggle */}
        {onToggleLowStock && (
          <div className="flex items-center space-x-2 bg-white border rounded-md px-3 py-2">
            <input
              type="checkbox"
              id="low-stock-filter"
              checked={showLowStockOnly}
              onChange={(e) => onToggleLowStock(e.target.checked)}
              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
            />
            <Label htmlFor="low-stock-filter" className="text-sm font-medium cursor-pointer flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${showLowStockOnly ? 'bg-red-500' : 'bg-gray-300'}`} />
              Low Stock Only
            </Label>
          </div>
        )}
      </div>

      {searchTerm && (rawProducts.length > 0 || rawComponents.length > 0) && (
        <div className="mt-2 mb-4">
          <Badge variant="outline" className="bg-blue-50">
            Showing {allProducts.length + allComponents.length} of {rawProducts.length + rawComponents.length} items
          </Badge>
        </div>
      )}

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Current Stock</TableHead>
              <TableHead>Min Threshold</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allProducts.map((product: any) => (
              <TableRow key={`product-${product.id}`}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <div className="h-10 w-10 rounded bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 overflow-hidden flex-shrink-0">
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                            const placeholderIcon = document.createElement('div');
                            placeholderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package h-4 w-4"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.29 7 9.71 5.29 9.71-5.29"/><path d="M8 5.48v5.48L12 12"/></svg>`;
                            e.currentTarget.parentElement?.appendChild(placeholderIcon.firstChild!);
                          }}
                        />
                      ) : (
                        <Coffee className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">
                  {product.type === 'component_based' ? 'Bundle-Based Product' : 'Finished Good'}
                </TableCell>
                <TableCell>
                  {product.type === 'component_based' ? (
                    <span className="text-gray-400 italic">Bundle-Based</span>
                  ) : (
                    Math.floor(Number(product.stockQuantity))
                  )}
                </TableCell>
                <TableCell>
                  {product.type === 'component_based' ? '-' : product.minThreshold}
                </TableCell>
                <TableCell>
                  {product.type === 'component_based' ? (
                    <Badge variant="outline">Managed via Components</Badge>
                  ) : (
                    getStockStatusBadge(product.stockQuantity, product.minThreshold)
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <RestockDialog
                      item={{
                        id: product.id,
                        name: product.name,
                        stockQuantity: product.stockQuantity,
                        type: 'product',
                        productType: product.type
                      }}
                    >
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700" disabled={product.type === 'ingredient_based'}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </RestockDialog>

                    <StockAdjustmentDialog
                      item={{
                        id: product.id,
                        name: product.name,
                        stockQuantity: product.stockQuantity,
                        type: 'product',
                        productType: product.type
                      }}
                    >
                      <Button variant="ghost" size="sm" disabled={product.type === 'ingredient_based'}>
                        <Settings className="h-4 w-4" />
                      </Button>
                    </StockAdjustmentDialog>

                    <BarcodePrintDialog product={product} />

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        // Navigate to products tab to edit the product
                        const productsTab = document.querySelector('[data-value="products"]') as HTMLElement;
                        if (productsTab) {
                          productsTab.click();
                        }
                      }}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {allComponents.map((component: any) => (
              <TableRow key={`component-${component.id}`}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{component.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">Component ({component.unit})</TableCell>
                <TableCell>{Number(component.stockQuantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                <TableCell>{Number(component.minThreshold).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {getStockStatusBadge(parseFloat(component.stockQuantity), parseFloat(component.minThreshold))}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <RestockDialog
                      item={{
                        id: component.id,
                        name: component.name,
                        stockQuantity: component.stockQuantity,
                        unit: component.unit,
                        type: 'component'
                      }}
                    >
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </RestockDialog>

                    <StockAdjustmentDialog
                      item={{
                        id: component.id,
                        name: component.name,
                        stockQuantity: component.stockQuantity,
                        unit: component.unit,
                        type: 'component'
                      }}
                    >
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </StockAdjustmentDialog>

                    <EditComponentDialog component={component}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </EditComponentDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Component</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{component.name}"? This action cannot be undone.
                            If this component is used in bundles, deletion may fail.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteComponentMutation.mutate(component.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}

            {allProducts.length === 0 && allComponents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {showComponentsOnly ? 'No components found. Add components to start managing bundles.' : 'No low stock items found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}