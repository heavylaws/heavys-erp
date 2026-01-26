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
import { Edit, Trash2, Package, Plus, Box, Settings, Search, X } from "lucide-react";
import { EditProductDialog } from "@/components/edit-product-dialog";
import { AddProductDialog } from "@/components/add-product-dialog";
import { BundleManager } from "@/components/bundle-manager";
import { RestockDialog } from "@/components/restock-dialog";
import { StockAdjustmentDialog } from "@/components/stock-adjustment-dialog";
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
    <div className="space-y-6 animate-fade-in-up">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-800 to-gray-600">Product Inventory</h2>
          <p className="text-gray-500 text-sm">Manage your catalog, prices, and stock levels</p>
        </div>
        <AddProductDialog>
          <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-blue-500/20 transition-all hover:scale-105">
            <Plus className="h-4 w-4 mr-2" />
            Add New Product
          </Button>
        </AddProductDialog>
      </div>

      {/* Modern Search Bar */}
      <Card className="glass-card border-none shadow-sm">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <Input
              placeholder="Search products by name, barcode, or description..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 h-12 bg-white/50 border-gray-100 focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 transition-all rounded-xl text-lg"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
          {/* Future Filter Chips can go here */}
          <div className="hidden md:flex gap-2">
            <Badge variant="outline" className="h-10 px-4 rounded-lg cursor-pointer hover:bg-white hover:border-blue-200 transition-colors">
              All Categories
            </Badge>
            <Badge variant="outline" className="h-10 px-4 rounded-lg cursor-pointer hover:bg-white hover:border-blue-200 transition-colors">
              Stock Status
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Main Table Card */}
      <Card className="glass-card border-none shadow-xl overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow className="hover:bg-transparent border-gray-100">
                <TableHead className="w-[80px] pl-6">Image</TableHead>
                <TableHead>Product Details</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock Status</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-64 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <Package className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-lg font-medium text-gray-500">No products found</p>
                      <p className="text-sm">Try adjusting your search or add a new product</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
                  <TableRow key={product.id} className="hover:bg-slate-50/80 transition-colors border-gray-100 group">
                    <TableCell className="pl-6">
                      <div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 shadow-sm overflow-hidden">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              // If image fails, revert to placeholder
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center');
                              const placeholderIcon = document.createElement('div');
                              placeholderIcon.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-package h-6 w-6"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><path d="m3.29 7 9.71 5.29 9.71-5.29"/><path d="M8 5.48v5.48L12 12"/></svg>`;
                              e.currentTarget.parentElement?.appendChild(placeholderIcon.firstChild!);
                            }}
                          />
                        ) : (
                          <Package className="h-6 w-6" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="cursor-pointer" onClick={() => setExpandedProduct(expandedProduct === product.id ? null : product.id)}>
                        <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                          {product.name}
                          {expandedProduct === product.id && <Settings className="h-3 w-3 text-blue-500 animate-spin-slow" />}
                        </h4>
                        <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                          <span>SKU: {product.barcode || 'N/A'}</span>
                          {product.description && <span className="w-1 h-1 bg-gray-300 rounded-full"></span>}
                          {product.description && <span className="truncate max-w-[200px]">{product.description}</span>}
                        </div>

                        {expandedProduct === product.id && (product as any).optionGroups && (
                          <div className="mt-4 p-4 bg-slate-50/80 rounded-xl border border-blue-100 shadow-inner">
                            <div className="text-xs font-bold text-blue-800 uppercase tracking-wider mb-2">Attached Options</div>
                            <ul className="space-y-2 mb-3">
                              {(product as any).optionGroups.map((g: any) => (
                                <li key={g.id} className="flex items-center justify-between bg-white rounded-lg border border-blue-100 px-3 py-2 shadow-sm">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-none">{g.name}</Badge>
                                    {g.required && <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">REQUIRED</span>}
                                    <span className="text-[10px] text-gray-500 font-mono">{g.selectionType}</span>
                                  </div>
                                  <Button size="sm" variant="ghost" className="h-6 text-red-400 hover:text-red-600 hover:bg-red-50" onClick={() => {
                                    const mapping = (product as any).optionGroupsRaw?.find((m: any) => m.group.id === g.id) || (product as any).optionGroupsMapping?.find((m: any) => m.optionGroupId === g.id);
                                    if (mapping) detachMutation.mutate({ mappingId: mapping.id });
                                  }}>Detach</Button>
                                </li>
                              ))}
                              {!(product as any).optionGroups.length && <li className="text-xs text-gray-400 italic">No options attached</li>}
                            </ul>
                            <div className="flex items-center gap-2">
                              <select
                                className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                defaultValue=""
                                onChange={(e) => { const val = e.target.value; if (val) { attachMutation.mutate({ productId: product.id, optionGroupId: val }); e.target.value = ''; } }}
                              >
                                <option value="" disabled>Link new option group...</option>
                                {optionGroups.filter((og: any) => !(product as any).optionGroups?.some((pg: any) => pg.id === og.id)).map((og: any) => (
                                  <option key={og.id} value={og.id}>{og.name}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-200">
                        {getCategoryName(product.categoryId)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {product.type === 'finished_good' ? (
                          <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-amber-400"></div>
                        )}
                        <span className="text-sm font-medium text-gray-600">
                          {product.type === 'finished_good' ? 'Finished' : 'Bundle'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-gray-800 font-mono">${parseFloat(product.price).toFixed(2)}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col items-start gap-1">
                        {Number(product.stockQuantity) <= Number(product.minThreshold) ? (
                          <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-none shadow-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 animate-pulse"></span>
                            Low Stock ({Number(product.stockQuantity)})
                          </Badge>
                        ) : (
                          <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-none shadow-none">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>
                            In Stock ({Number(product.stockQuantity)})
                          </Badge>
                        )}
                        <span className="text-[10px] text-gray-400 pl-2">Min: {product.minThreshold}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right pr-6">
                      <div className="flex justify-end gap-1 opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity">
                        <RestockDialog item={{ id: product.id, name: product.name, stockQuantity: product.stockQuantity, type: 'product', productType: product.type }}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50 rounded-full" title="Restock">
                            <Plus className="h-4 w-4" />
                          </Button>
                        </RestockDialog>

                        <StockAdjustmentDialog item={{ id: product.id, name: product.name, stockQuantity: product.stockQuantity, type: 'product', productType: product.type }}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-600 hover:bg-gray-100 rounded-full" title="Adjust Stock">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </StockAdjustmentDialog>

                        {product.type === 'component_based' && (
                          <BundleManager productId={product.id} productName={product.name} trigger={
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-amber-600 hover:bg-amber-50 rounded-full" title="Manage Bundle">
                              <Box className="h-4 w-4" />
                            </Button>
                          } />
                        )}

                        <BarcodePrintDialog product={product} />

                        <EditProductDialog product={product}>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-full" title="Edit">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </EditProductDialog>

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50 rounded-full" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure? This action is irreversible.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteProductMutation.mutate(product.id)} className="bg-red-600">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}