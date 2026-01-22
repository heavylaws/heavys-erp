import { Badge } from "@/components/ui/badge";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Edit, Coffee, Package, ChefHat, Trash2, Plus, Settings, Search, X } from "lucide-react";
import { RecipeManager } from "@/components/recipe-manager";
import type { Product, Ingredient } from "@shared/schema";
import { EditIngredientDialog } from "@/components/edit-ingredient-dialog";
import { RestockDialog } from "@/components/restock-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
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
    ingredients: any[];
  };
  showIngredientsOnly?: boolean;
  showAllInventory?: boolean;
  showLowStockOnly?: boolean;
  onToggleLowStock?: (value: boolean) => void;
}

export function InventoryTable({ lowStockData, showIngredientsOnly = false, showAllInventory = false, showLowStockOnly = false, onToggleLowStock }: InventoryTableProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all products when showing full inventory
  const { data: allProductsData = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    enabled: showAllInventory && !showIngredientsOnly,
  });

  // Fetch all ingredients 
  const { data: allIngredientsData = [], isLoading: ingredientsLoading } = useQuery<Ingredient[]>({
    queryKey: ["/api/ingredients"],
    enabled: showIngredientsOnly || showAllInventory,
  });

  // Filter out recipe-based products from inventory display since they're tracked via ingredients
  // Only show finished goods in inventory - recipe-based items are monitored through their ingredient consumption
  const finishedGoodsOnly = showAllInventory && !showIngredientsOnly ?
    allProductsData :
    showIngredientsOnly ? [] :
      (lowStockData?.products || []).filter((product: any) => product.type === 'finished_good');

  // Apply filtering
  let rawProducts = finishedGoodsOnly;
  let rawIngredients = showAllInventory || showIngredientsOnly ? allIngredientsData :
    (lowStockData?.ingredients || []);

  if (showLowStockOnly) {
    if (showAllInventory) {
      // If showing all inventory, we need to manually filter for low stock
      rawProducts = rawProducts.filter((p: any) => p.stockQuantity <= p.minThreshold);
      rawIngredients = rawIngredients.filter((i: any) => parseFloat(i.stockQuantity) <= parseFloat(i.minThreshold));
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

  const allIngredients = useMemo(() => {
    if (!rawIngredients || !searchTerm) return rawIngredients;

    const searchLower = searchTerm.toLowerCase();
    return rawIngredients.filter((ingredient: any) =>
      ingredient.name.toLowerCase().includes(searchLower) ||
      (ingredient.unit && ingredient.unit.toLowerCase().includes(searchLower))
    );
  }, [rawIngredients, searchTerm]);

  // ... existing delete mutation ...

  const deleteIngredientMutation = useMutation({
    mutationFn: async (ingredientId: string) => {
      const response = await apiRequest("DELETE", `/api/ingredients/${ingredientId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ingredients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: "Ingredient deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete ingredient. It may be used in recipes.",
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

  const isLoading = (showAllInventory && (productsLoading || ingredientsLoading)) ||
    (showIngredientsOnly && ingredientsLoading);

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

  const totalItems = allProducts.length + allIngredients.length;

  if (totalItems === 0 && !searchTerm && !showLowStockOnly) {
    return (
      <div className="text-center py-8">
        <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No inventory items found</p>
        <p className="text-sm text-gray-500 mt-2">
          {showIngredientsOnly ? "Add ingredients to start tracking inventory" : "Add products and ingredients to manage your inventory"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center mb-4">
        {(rawProducts.length > 0 || rawIngredients.length > 0 || searchTerm || showLowStockOnly) && (
          <div className="w-full sm:w-auto flex-1">
            <Label htmlFor="inventory-search" className="sr-only">Search Inventory</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="inventory-search"
                placeholder={
                  showIngredientsOnly
                    ? "Search ingredients..."
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

      {searchTerm && (rawProducts.length > 0 || rawIngredients.length > 0) && (
        <div className="mt-2 mb-4">
          <Badge variant="outline" className="bg-blue-50">
            Showing {allProducts.length + allIngredients.length} of {rawProducts.length + rawIngredients.length} items
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
                    <Coffee className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{product.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">
                  {product.type === 'ingredient_based' ? 'Recipe-Based Product' : 'Finished Good'}
                </TableCell>
                <TableCell>
                  {product.type === 'ingredient_based' ? (
                    <span className="text-gray-400 italic">Recipe-Based</span>
                  ) : (
                    Math.floor(Number(product.stockQuantity))
                  )}
                </TableCell>
                <TableCell>
                  {product.type === 'ingredient_based' ? '-' : product.minThreshold}
                </TableCell>
                <TableCell>
                  {product.type === 'ingredient_based' ? (
                    <Badge variant="outline">Managed via Ingredients</Badge>
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

            {allIngredients.map((ingredient: any) => (
              <TableRow key={`ingredient-${ingredient.id}`}>
                <TableCell>
                  <div className="flex items-center space-x-3">
                    <Package className="h-4 w-4 text-gray-400" />
                    <span className="font-medium">{ingredient.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-gray-600">Ingredient ({ingredient.unit})</TableCell>
                <TableCell>{Number(ingredient.stockQuantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                <TableCell>{Number(ingredient.minThreshold).toLocaleString(undefined, { maximumFractionDigits: 2 })}</TableCell>
                <TableCell>
                  {getStockStatusBadge(parseFloat(ingredient.stockQuantity), parseFloat(ingredient.minThreshold))}
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <RestockDialog
                      item={{
                        id: ingredient.id,
                        name: ingredient.name,
                        stockQuantity: ingredient.stockQuantity,
                        unit: ingredient.unit,
                        type: 'ingredient'
                      }}
                    >
                      <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </RestockDialog>

                    <StockAdjustmentDialog
                      item={{
                        id: ingredient.id,
                        name: ingredient.name,
                        stockQuantity: ingredient.stockQuantity,
                        unit: ingredient.unit,
                        type: 'ingredient'
                      }}
                    >
                      <Button variant="ghost" size="sm">
                        <Settings className="h-4 w-4" />
                      </Button>
                    </StockAdjustmentDialog>

                    <EditIngredientDialog ingredient={ingredient}>
                      <Button variant="ghost" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </EditIngredientDialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Ingredient</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{ingredient.name}"? This action cannot be undone.
                            If this ingredient is used in recipes, deletion may fail.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteIngredientMutation.mutate(ingredient.id)}
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

            {allProducts.length === 0 && allIngredients.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                  {showIngredientsOnly ? 'No ingredients found. Add ingredients to start managing recipes.' : 'No low stock items found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}