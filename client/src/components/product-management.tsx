import { useState, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Edit, Trash2, Package, Plus, ChefHat, Settings, Search, X } from "lucide-react";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { AddProductDialog } from "@/components/add-product-dialog";
import { RecipeManager } from "@/components/recipe-manager";
import { RestockDialog } from "@/components/restock-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
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
import { OptionGroupManagement } from '@/components/option-group-management';
import type { Product, Category } from "@shared/schema";

export function ProductManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: allProducts = [], isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  // Smart search across product name, description, barcode
  const products = useMemo(() => {
    if (!searchTerm) return allProducts;

    const searchLower = searchTerm.toLowerCase();
    return allProducts.filter(product =>
      product.name.toLowerCase().includes(searchLower) ||
      product.description?.toLowerCase().includes(searchLower) ||
      product.barcode?.toLowerCase().includes(searchLower)
    );
  }, [allProducts, searchTerm]);

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  const { data: optionGroups = [] } = useQuery({
    queryKey: ['/api/option-groups'],
    queryFn: async () => {
      const res = await fetch('/api/option-groups', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    }
  });
  const attachMutation = useMutation({
    mutationFn: async ({ productId, optionGroupId }: { productId: string; optionGroupId: string }) => {
      const res = await fetch('/api/product-option-groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ productId, optionGroupId }) });
      if (!res.ok) throw new Error('Attach failed');
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/products'] }); toast({ title: 'Group attached' }); },
    onError: (e: any) => toast({ title: 'Attach failed', description: e.message, variant: 'destructive' })
  });
  const detachMutation = useMutation({
    mutationFn: async ({ mappingId }: { mappingId: string }) => {
      const res = await fetch(`/api/product-option-groups/${mappingId}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Detach failed');
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['/api/products'] }); toast({ title: 'Group detached' }); },
    onError: (e: any) => toast({ title: 'Detach failed', description: e.message, variant: 'destructive' })
  });
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      const response = await apiRequest("DELETE", `/api/products/${productId}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      queryClient.invalidateQueries({ queryKey: ["/api/inventory/low-stock"] });
      toast({
        title: "Success",
        description: "Product deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete product.",
        variant: "destructive",
      });
    },
  });

  const getCategoryName = (categoryId: string | null) => {
    if (!categoryId) return "Uncategorized";
    const category = categories.find(c => c.id === categoryId);
    return category?.name || "Unknown";
  };

  const getStockStatusBadge = (current: number, threshold: number) => {
    if (current === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    } else if (current <= threshold) {
      return <Badge variant="secondary">Low Stock</Badge>;
    } else {
      return <Badge variant="default" className="bg-green-600">In Stock</Badge>;
    }
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
            <Package className="h-5 w-5" />
            <span>Product Management</span>
          </div>
          <AddProductDialog>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Button>
          </AddProductDialog>
        </CardTitle>

        {/* Smart Search */}
        <div className="mt-4">
          <Label htmlFor="product-search">Search Products</Label>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              id="product-search"
              placeholder="Search by name, description, or barcode..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              data-testid="input-product-search"
            />
            {searchTerm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                data-testid="button-clear-product-search"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchTerm && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-blue-50">
                Showing {products.length} of {allProducts.length} products
              </Badge>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {products.length === 0 ? (
          <div className="text-center py-8">
            <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-4">
              {searchTerm ? 'No products match your search' : 'No products found'}
            </p>
            {!searchTerm && (
              <AddProductDialog>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create First Product
                </Button>
              </AddProductDialog>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="cursor-pointer" onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}>
                      <div className="font-medium flex items-center gap-2">
                        <span>{product.name}</span>
                        {expandedProduct === product.id && <span className="text-xs text-blue-600">(collapse)</span>}
                      </div>
                      {product.description && (
                        <div className="text-sm text-gray-500">{product.description}</div>
                      )}
                      {expandedProduct === product.id && (product as any).optionGroups && (
                        <div className="mt-2 space-y-2">
                          <div className="text-xs font-semibold text-gray-600">Attached Option Groups:</div>
                          <ul className="space-y-1">
                            {(product as any).optionGroups.map((g: any) => (
                              <li key={g.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{g.name}</span>
                                  {g.required && <span className="text-[10px] bg-red-100 text-red-600 px-1 rounded">req</span>}
                                  <span className="text-[10px] text-gray-500">{g.selectionType}</span>
                                </div>
                                <Button size="sm" variant="ghost" onClick={() => {
                                  const mapping = (product as any).optionGroupsRaw?.find((m: any) => m.group.id === g.id) || (product as any).optionGroupsMapping?.find((m: any) => m.optionGroupId === g.id);
                                  if (mapping) detachMutation.mutate({ mappingId: mapping.id });
                                }}>Remove</Button>
                              </li>
                            ))}
                            {!(product as any).optionGroups.length && <li className="text-xs text-gray-500">None attached</li>}
                          </ul>
                          <div className="flex items-center gap-2 mt-2">
                            <select className="border rounded px-2 py-1 text-sm" defaultValue="" onChange={(e) => { const val = e.target.value; if (val) { attachMutation.mutate({ productId: product.id, optionGroupId: val }); e.target.value = ''; } }}>
                              <option value="" disabled>Add group…</option>
                              {optionGroups.filter((og: any) => !(product as any).optionGroups?.some((pg: any) => pg.id === og.id)).map((og: any) => (
                                <option key={og.id} value={og.id}>{og.name}</option>
                              ))}
                            </select>
                            {attachMutation.isPending && <span className="text-xs text-gray-500">Attaching…</span>}
                            {detachMutation.isPending && <span className="text-xs text-gray-500">Detaching…</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getCategoryName(product.categoryId)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={product.type === 'finished_good' ? 'default' : 'secondary'}>
                      {product.type === 'finished_good' ? 'Finished Good' : 'Recipe-Based'}
                    </Badge>
                  </TableCell>
                  <TableCell>${parseFloat(product.price).toFixed(2)}</TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <span>
                        {product.type === 'finished_good'
                          ? Math.floor(Number(product.stockQuantity))
                          : Number(product.stockQuantity).toLocaleString(undefined, { maximumFractionDigits: 3 })}
                      </span>
                      <span className="text-gray-400">/ {product.minThreshold}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStockStatusBadge(Number(product.stockQuantity), Number(product.minThreshold))}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <RestockDialog
                        item={{
                          id: product.id,
                          name: product.name,
                          stockQuantity: product.stockQuantity,

                          type: 'product',
                          productType: product.type
                        }}
                      >
                        <Button variant="ghost" size="sm" className="text-green-600 hover:text-green-700">
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
                        <Button variant="ghost" size="sm">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </StockAdjustmentDialog>

                      {product.type === 'ingredient_based' && (
                        <RecipeManager productId={product.id} productName={product.name} trigger={
                          <Button variant="ghost" size="sm">
                            <ChefHat className="h-4 w-4" />
                          </Button>
                        } />
                      )}

                      <EditProductDialog product={product}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </EditProductDialog>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{product.name}"? This action cannot be undone.
                              This will deactivate the product from sales.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteProductMutation.mutate(product.id)}
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
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}