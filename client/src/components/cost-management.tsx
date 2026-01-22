import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Edit, TrendingUp, TrendingDown, BarChart3, Calculator, Search, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Product {
  id: string;
  name: string;
  price: string;
  stockQuantity: number;
  costPerUnit?: string;
  type?: string; // Added for recipe-based products
}

interface Ingredient {
  id: string;
  name: string;
  unit: string;
  stockQuantity: string;
  costPerUnit?: string;
}

// Mock data for recipe ingredients - replace with actual data fetching
const recipeIngredients: { [productId: string]: { ingredientId: string; quantity: string }[] } = {
  'product-1': [
    { ingredientId: 'ingredient-1', quantity: '2' },
    { ingredientId: 'ingredient-2', quantity: '1' },
  ],
  'product-2': [
    { ingredientId: 'ingredient-1', quantity: '1' },
    { ingredientId: 'ingredient-3', quantity: '0.5' },
  ],
};


interface CostUpdateData {
  costPerUnit: string;
}

// Mock EditCostDialog component - replace with your actual component
const EditCostDialog = ({ product, onSave }: { product: Product; onSave: (cost: { costPerUnit: string }) => void }) => {
  const [costInput, setCostInput] = useState(product.costPerUnit || '');

  const handleSave = () => {
    onSave({ costPerUnit: costInput });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid={`button-edit-cost-${product.id}`}>
          <Edit className="h-4 w-4 mr-1" />
          Edit Cost
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Cost - {product.name}</DialogTitle>
          <DialogDescription>Update the cost per unit for this product.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Label htmlFor="cost-per-unit">Cost Per Unit ($)</Label>
          <Input
            id="cost-per-unit"
            type="number"
            step="0.01"
            min="0"
            value={costInput}
            onChange={(e) => setCostInput(e.target.value)}
            placeholder="0.00"
            data-testid="input-cost-per-unit"
          />
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button onClick={handleSave}>Save Cost</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export function CostManagement() {
  const queryClient = useQueryClient();
  const [editingItem, setEditingItem] = useState<
    | { type: 'product'; item: Product }
    | { type: 'ingredient'; item: Ingredient }
    | null
  >(null);
  const [costData, setCostData] = useState<CostUpdateData>({ costPerUnit: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['/api/products'],
  });

  const { data: ingredients = [] } = useQuery<Ingredient[]>({
    queryKey: ['/api/ingredients'],
  });

  // Calculate total cost from ingredients for recipe-based products
  const calculateRecipeCost = (product: any) => {
    if (product.type !== 'ingredient_based' || !recipeIngredients[product.id]) {
      return null;
    }

    const totalCost = recipeIngredients[product.id].reduce((sum: number, ri: any) => {
      const ingredient = ingredients.find(ing => ing.id === ri.ingredientId);
      if (ingredient && ingredient.costPerUnit) {
        return sum + (parseFloat(ingredient.costPerUnit) * parseFloat(ri.quantity));
      }
      return sum;
    }, 0);

    return totalCost > 0 ? totalCost : null;
  };

  // Update product cost automatically for recipe-based items
  const updateRecipeBasedCost = async (productId: string, calculatedCost: number) => {
    try {
      await apiRequest('PATCH', `/api/products/${productId}`, {
        costPerUnit: calculatedCost.toFixed(4)
      });
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Cost Updated",
        description: "Recipe-based product cost calculated and saved automatically.",
      });
    } catch (error) {
      console.error('Error updating recipe cost:', error);
    }
  };

  const updateCostMutation = useMutation({
    mutationFn: async ({ id, type, data }: { id: string; type: 'product' | 'ingredient'; data: CostUpdateData }) => {
      const endpoint = type === 'product' ? `/api/products/${id}` : `/api/ingredients/${id}`;
      const response = await apiRequest("PATCH", endpoint, data);
      return response.json();
    },
    onSuccess: (updatedData, { type }) => {
      // Force immediate cache invalidation and refetch
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ingredients'] });

      // Force refetch to ensure latest data
      queryClient.refetchQueries({ queryKey: ['/api/products'] });
      queryClient.refetchQueries({ queryKey: ['/api/ingredients'] });

      toast({
        title: "Cost Updated",
        description: `${type === 'product' ? 'Product' : 'Ingredient'} cost has been successfully updated`,
      });
      setEditingItem(null);
      setCostData({ costPerUnit: '' });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update cost",
        variant: "destructive",
      });
    },
  });

  // Mock mutation for updating product cost - replace with actual mutation
  const updateProductCostMutation = useMutation({
    mutationFn: async ({ productId, cost }: { productId: string; cost: string }) => {
      await apiRequest('PATCH', `/api/products/${productId}`, { costPerUnit: cost });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({
        title: "Cost Updated",
        description: "Product cost has been successfully updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update product cost",
        variant: "destructive",
      });
    },
  });

  const calculateProfitMargin = (price: string, cost?: string) => {
    if (!cost || !price) return null;
    const priceNum = parseFloat(price);
    const costNum = parseFloat(cost);
    if (costNum === 0) return null;
    return (((priceNum - costNum) / priceNum) * 100).toFixed(1);
  };

  const calculateProfitAmount = (price: string, cost?: string) => {
    if (!cost || !price) return null;
    const priceNum = parseFloat(price);
    const costNum = parseFloat(cost);
    return (priceNum - costNum).toFixed(2);
  };

  const getTotalValue = (items: (Product | Ingredient)[]) => {
    return items.reduce((total, item) => {
      const cost = item.costPerUnit ? parseFloat(item.costPerUnit) : 0;
      const quantity = typeof item.stockQuantity === 'string' 
        ? parseFloat(item.stockQuantity) 
        : item.stockQuantity;
      return total + (cost * quantity);
    }, 0).toFixed(2);
  };

  const handleEditCost = (item: Product | Ingredient, type: 'product' | 'ingredient') => {
    if (type === 'product') {
      setEditingItem({ type: 'product', item: item as Product });
    } else {
      setEditingItem({ type: 'ingredient', item: item as Ingredient });
    }
    setCostData({ costPerUnit: item.costPerUnit || '' });
  };

  // Smart search across products (name, description, barcode)
  const filteredProducts = useMemo(() => {
    if (!products) return [];

    if (!searchTerm) return products;

    const searchLower = searchTerm.toLowerCase();
    return products.filter(product => {
      return product.name.toLowerCase().includes(searchLower) ||
             (product as any).description?.toLowerCase().includes(searchLower) ||
             (product as any).barcode?.toLowerCase().includes(searchLower);
    });
  }, [products, searchTerm]);

  const filteredIngredients = useMemo(() => {
    if (!ingredients) return [];

    if (!searchTerm) return ingredients;

    const searchLower = searchTerm.toLowerCase();
    return ingredients.filter(ingredient => 
      ingredient.name.toLowerCase().includes(searchLower)
    );
  }, [ingredients, searchTerm]);

  const getCostStatus = (item: Product | Ingredient, type: 'product' | 'ingredient') => {
    if (!item.costPerUnit) {
      return { status: 'missing', color: 'bg-red-100 text-red-800', text: 'No Cost Data' };
    }
    if (type === 'product') {
      const product = item as Product;
      const margin = calculateProfitMargin(product.price, product.costPerUnit);
      if (!margin) return { status: 'unknown', color: 'bg-gray-100 text-gray-800', text: 'Unknown' };
      const marginNum = parseFloat(margin);
      if (marginNum < 20) return { status: 'low', color: 'bg-orange-100 text-orange-800', text: `${margin}% margin` };
      if (marginNum < 40) return { status: 'medium', color: 'bg-yellow-100 text-yellow-800', text: `${margin}% margin` };
      return { status: 'good', color: 'bg-green-100 text-green-800', text: `${margin}% margin` };
    }
    return { status: 'set', color: 'bg-blue-100 text-blue-800', text: 'Cost Set' };
  };

  return (
    <div className="space-y-6" data-testid="cost-management">
      {/* Cost Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Product Inventory Value</p>
                <p className="text-2xl font-bold text-green-600">
                  ${getTotalValue(products || [])}
                </p>
                <p className="text-xs text-green-600">Based on cost data</p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <DollarSign className="text-green-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Ingredient Inventory Value</p>
                <p className="text-2xl font-bold text-blue-600">
                  ${getTotalValue(ingredients || [])}
                </p>
                <p className="text-xs text-blue-600">Raw materials value</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <BarChart3 className="text-blue-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Items Missing Cost Data</p>
                <p className="text-2xl font-bold text-orange-600">
                  {[...(products || []), ...(ingredients || [])].filter(item => !item.costPerUnit).length}
                </p>
                <p className="text-xs text-orange-600">Needs attention</p>
              </div>
              <div className="bg-orange-100 p-3 rounded-lg">
                <Calculator className="text-orange-600 h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cost Management & Profit Analysis</CardTitle>
          <div className="mt-4">
            <Label htmlFor="smart-search">Search Products & Ingredients</Label>
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                id="smart-search"
                placeholder="Search by name, description, or barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                data-testid="input-smart-search"
              />
              {searchTerm && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="products">
            <TabsList>
              <TabsTrigger value="products" data-testid="tab-products">Products</TabsTrigger>
              <TabsTrigger value="ingredients" data-testid="tab-ingredients">Ingredients</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Product Cost & Profit Analysis</h3>
                <div className="flex gap-2">
                  {searchTerm && (
                    <Badge variant="outline" className="bg-blue-50">
                      Showing {filteredProducts.length} of {products?.length || 0}
                    </Badge>
                  )}
                  <Badge variant="secondary">{products?.length || 0} total products</Badge>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product Name</TableHead>
                    <TableHead>Selling Price</TableHead>
                    <TableHead>Cost Per Unit</TableHead>
                    <TableHead>Profit Per Unit</TableHead>
                    <TableHead>Profit Margin</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No products match your search' : 'No products found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => {
                      const profitAmount = calculateProfitAmount(product.price, product.costPerUnit);
                      const profitMargin = calculateProfitMargin(product.price, product.costPerUnit);
                      const status = getCostStatus(product, 'product');

                      return (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="font-mono">${product.price}</TableCell>
                          <TableCell className="font-mono">
                            {product.costPerUnit ? (
                              product.type === 'ingredient_based' ? (
                                <>
                                  <span className="text-green-600 font-medium">
                                    ${parseFloat(product.costPerUnit).toFixed(2)}
                                  </span>
                                  <span className="text-xs text-blue-600 ml-2">
                                    (Calculated from recipe)
                                  </span>
                                </>
                              ) : (
                                <span className="text-green-600 font-medium">
                                  ${parseFloat(product.costPerUnit).toFixed(2)}
                                </span>
                              )
                            ) : product.type === 'ingredient_based' ? (
                              // Recipe-based products: show calculated cost or calculate button
                              (() => {
                                const calculatedCost = calculateRecipeCost(product);
                                return calculatedCost ? (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-blue-600 font-medium">
                                      ${calculatedCost.toFixed(2)} (Calculated)
                                    </span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => updateRecipeBasedCost(product.id, calculatedCost)}
                                      className="text-xs"
                                    >
                                      Save Cost
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center space-x-2">
                                    <span className="text-orange-600">Missing ingredient costs</span>
                                    <EditCostDialog
                                      product={product}
                                      onSave={(cost) => {
                                        updateProductCostMutation.mutate({
                                          productId: product.id,
                                          cost: cost.costPerUnit
                                        });
                                      }}
                                    />
                                  </div>
                                );
                              })()
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className="text-red-600">No cost data</span>
                                <EditCostDialog
                                  product={product}
                                  onSave={(cost) => {
                                    updateProductCostMutation.mutate({
                                      productId: product.id,
                                      cost: cost.costPerUnit
                                    });
                                  }}
                                />
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="font-mono">
                            {profitAmount ? `$${profitAmount}` : 'N/A'}
                          </TableCell>
                          <TableCell>
                            {profitMargin ? (
                              <div className="flex items-center gap-1">
                                {parseFloat(profitMargin) > 0 ? (
                                  <TrendingUp className="h-4 w-4 text-green-500" />
                                ) : (
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                )}
                                {profitMargin}%
                              </div>
                            ) : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCost(product, 'product')}
                              data-testid={`button-edit-cost-${product.id}`}
                              disabled={product.type === 'ingredient_based'} // Disable editing for calculated costs
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit Cost
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="ingredients" className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium">Ingredient Cost Management</h3>
                <div className="flex gap-2">
                  {searchTerm && (
                    <Badge variant="outline" className="bg-blue-50">
                      Showing {filteredIngredients.length} of {ingredients?.length || 0}
                    </Badge>
                  )}
                  <Badge variant="secondary">{ingredients?.length || 0} total ingredients</Badge>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ingredient Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Current Stock</TableHead>
                    <TableHead>Cost Per Unit</TableHead>
                    <TableHead>Total Value</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIngredients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                        {searchTerm ? 'No ingredients match your search' : 'No ingredients found'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIngredients.map((ingredient) => {
                      const status = getCostStatus(ingredient, 'ingredient');
                      const totalValue = ingredient.costPerUnit 
                        ? (parseFloat(ingredient.costPerUnit) * parseFloat(ingredient.stockQuantity)).toFixed(2)
                        : 'N/A';

                      return (
                        <TableRow key={ingredient.id}>
                          <TableCell className="font-medium">{ingredient.name}</TableCell>
                          <TableCell>{ingredient.unit}</TableCell>
                          <TableCell>{ingredient.stockQuantity}</TableCell>
                          <TableCell className="font-mono">
                            {ingredient.costPerUnit ? `$${ingredient.costPerUnit}` : 'Not set'}
                          </TableCell>
                          <TableCell className="font-mono">${totalValue}</TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              {status.text}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCost(ingredient, 'ingredient')}
                              data-testid={`button-edit-ingredient-cost-${ingredient.id}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit Cost
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Edit Cost Dialog */}
      {editingItem && (
        <Dialog open={!!editingItem} onOpenChange={() => setEditingItem(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Edit Cost - {editingItem.item.name}
              </DialogTitle>
              <DialogDescription>
                Update the cost per unit for this {editingItem.type}.
                {editingItem.type === 'product' && editingItem.item.type !== 'ingredient_based' && ' This will affect profit margin calculations.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <Label htmlFor="cost-per-unit">Cost Per Unit ($)</Label>
                <Input
                  id="cost-per-unit"
                  type="number"
                  step="0.01"
                  min="0"
                  value={costData.costPerUnit}
                  onChange={(e) => setCostData({ costPerUnit: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-cost-per-unit"
                />
              </div>

              {editingItem.type === 'product' && costData.costPerUnit && editingItem.item.type !== 'ingredient_based' && (
                <div className="p-3 bg-gray-50 rounded-lg">
                  <h4 className="font-medium mb-2">Profit Analysis</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Selling Price:</span>
                      <span>${(editingItem.item as Product).price}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cost:</span>
                      <span>${costData.costPerUnit}</span>
                    </div>
                    <div className="flex justify-between border-t pt-1 font-medium">
                      <span>Profit Per Unit:</span>
                      <span>${calculateProfitAmount((editingItem.item as Product).price, costData.costPerUnit)}</span>
                    </div>
                    <div className="flex justify-between font-medium">
                      <span>Profit Margin:</span>
                      <span>{calculateProfitMargin((editingItem.item as Product).price, costData.costPerUnit)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingItem(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => updateCostMutation.mutate({
                  id: editingItem.item.id,
                  type: editingItem.type,
                  data: costData
                })}
                disabled={!costData.costPerUnit || parseFloat(costData.costPerUnit) < 0}
                data-testid="button-save-cost"
              >
                Save Cost
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}