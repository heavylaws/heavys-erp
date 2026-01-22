import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Star, Trash2, Edit } from "lucide-react";
import type { FavoriteCombo, FavoriteComboItem, Product } from "@shared/schema";

interface ComboFormItem {
  productId: string;
  quantity: number;
}

interface ComboFormState {
  name: string;
  description: string;
  isActive: boolean;
  displayOrder: number;
  items: ComboFormItem[];
}

export type FavoriteComboWithItems = FavoriteCombo & {
  items: Array<FavoriteComboItem & { product?: Product | null }>;
};

const defaultFormState: ComboFormState = {
  name: "",
  description: "",
  isActive: true,
  displayOrder: 0,
  items: [{ productId: "", quantity: 1 }],
};

export function FavoriteCombosManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCombo, setEditingCombo] = useState<FavoriteComboWithItems | null>(null);
  const [formState, setFormState] = useState<ComboFormState>(defaultFormState);

  const { data: combos = [], isLoading: combosLoading } = useQuery<FavoriteComboWithItems[]>({
    queryKey: ["/api/favorites", { includeInactive: true }],
    queryFn: async () => {
      const response = await fetch("/api/favorites?includeInactive=true", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load favorite combos");
      }
      return response.json();
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
    queryFn: async () => {
      const response = await fetch("/api/products", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load products");
      }
      return response.json();
    },
  });

  const sortedProducts = useMemo(() => {
    return [...products].sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const invalidateCombos = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/favorites"] });
    queryClient.invalidateQueries({ queryKey: ["/api/favorites", { includeInactive: true }] });
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingCombo(null);
    setFormState({ ...defaultFormState, items: [{ productId: "", quantity: 1 }] });
  };

  const openCreateDialog = () => {
    setEditingCombo(null);
    setFormState({
      ...defaultFormState,
      displayOrder: combos.length,
      items: [{ productId: "", quantity: 1 }],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (combo: FavoriteComboWithItems) => {
    setEditingCombo(combo);
    setFormState({
      name: combo.name,
      description: combo.description ?? "",
      isActive: combo.isActive,
      displayOrder: combo.displayOrder ?? 0,
      items: combo.items.length > 0
        ? combo.items.map((item) => ({
            productId: item.productId,
            quantity: typeof item.quantity === "number" ? item.quantity : Number(item.quantity) || 1,
          }))
        : [{ productId: "", quantity: 1 }],
    });
    setDialogOpen(true);
  };

  const setItemValue = (index: number, updates: Partial<ComboFormItem>) => {
    setFormState((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], ...updates };
      return { ...prev, items: nextItems };
    });
  };

  const addItemRow = () => {
    setFormState((prev) => ({
      ...prev,
      items: [...prev.items, { productId: "", quantity: 1 }],
    }));
  };

  const removeItemRow = (index: number) => {
    setFormState((prev) => {
      if (prev.items.length === 1) return prev;
      const nextItems = prev.items.filter((_, idx) => idx !== index);
      return { ...prev, items: nextItems };
    });
  };

  const validateForm = (): boolean => {
    if (!formState.name.trim()) {
      toast({ title: "Name required", description: "Provide a name for the combo.", variant: "destructive" });
      return false;
    }

    const productIds = formState.items.map((item) => item.productId).filter(Boolean);
    if (productIds.length === 0) {
      toast({ title: "Add products", description: "Select at least one product for the combo.", variant: "destructive" });
      return false;
    }

    if (productIds.length !== new Set(productIds).size) {
      toast({ title: "Duplicate products", description: "Each product can only appear once in a combo.", variant: "destructive" });
      return false;
    }

    if (formState.items.some((item) => item.quantity <= 0)) {
      toast({ title: "Invalid quantity", description: "Quantities must be at least 1.", variant: "destructive" });
      return false;
    }

    return true;
  };

  const createMutation = useMutation({
    mutationFn: async (data: ComboFormState) => {
      const response = await apiRequest("POST", "/api/favorites", data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Combo created", description: "Favorite combo ready for cashiers." });
      invalidateCombos();
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Create failed", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ComboFormState> }) => {
      const response = await apiRequest("PUT", `/api/favorites/${id}`, data);
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Combo updated", description: "Changes saved successfully." });
      invalidateCombos();
      closeDialog();
    },
    onError: (error: Error) => {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/favorites/${id}`);
      return id;
    },
    onSuccess: () => {
      toast({ title: "Combo removed", description: "The combo is no longer available." });
      invalidateCombos();
    },
    onError: (error: Error) => {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    },
  });

  const handleSubmit = () => {
    if (!validateForm()) return;

    const payload: ComboFormState = {
      ...formState,
      name: formState.name.trim(),
      description: formState.description.trim(),
      items: formState.items.map((item) => ({
        productId: item.productId,
        quantity: Number(item.quantity) || 1,
      })),
    };

    if (editingCombo) {
      updateMutation.mutate({ id: editingCombo.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center space-x-2">
          <Star className="h-5 w-5" />
          <span>Quick Combos & Favorites</span>
        </CardTitle>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          New Combo
        </Button>
      </CardHeader>
      <CardContent>
        {combosLoading || productsLoading ? (
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading data…</span>
          </div>
        ) : combos.length === 0 ? (
          <div className="text-sm text-gray-500">
            No combos created yet. Add your first quick combo to help cashiers ring popular orders faster.
          </div>
        ) : (
          <div className="space-y-4">
            {combos.map((combo) => (
              <div key={combo.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-lg font-semibold text-neutral">{combo.name}</h3>
                      <Badge variant={combo.isActive ? "default" : "secondary"}>
                        {combo.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    {combo.description && (
                      <p className="mt-1 text-sm text-gray-600">{combo.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="icon" onClick={() => openEditDialog(combo)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      onClick={() => {
                        if (window.confirm(`Remove combo "${combo.name}"?`)) {
                          deleteMutation.mutate(combo.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {combo.items.map((item) => {
                    const productLabel = item.product?.name ?? "Unknown product";
                    return (
                      <div key={item.id} className="rounded border border-dashed border-gray-200 p-2 text-sm">
                        <div className="font-medium text-neutral">{productLabel}</div>
                        <div className="text-gray-500">Qty: {item.quantity}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingCombo ? "Edit Combo" : "Create Combo"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="combo-name">Name</Label>
                <Input
                  id="combo-name"
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="combo-order">Display Order</Label>
                <Input
                  id="combo-order"
                  type="number"
                  min={0}
                  value={formState.displayOrder}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, displayOrder: Number(event.target.value) || 0 }))
                  }
                />
              </div>
            </div>
            <div>
              <Label htmlFor="combo-description">Description</Label>
              <Textarea
                id="combo-description"
                value={formState.description}
                onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                rows={3}
              />
            </div>
            <div className="flex items-center space-x-3">
              <Switch
                id="combo-active"
                checked={formState.isActive}
                onCheckedChange={(checked) => setFormState((prev) => ({ ...prev, isActive: checked }))}
              />
              <Label htmlFor="combo-active">Visible to cashiers</Label>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="font-semibold">Products in Combo</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItemRow}>
                  <Plus className="h-4 w-4 mr-2" /> Add Product
                </Button>
              </div>

              <div className="space-y-3">
                {formState.items.map((item, index) => (
                  <div key={`combo-item-${index}`} className="grid gap-3 sm:grid-cols-6">
                    <div className="sm:col-span-4">
                      <Label className="text-sm">Product</Label>
                      <Select
                        value={item.productId}
                        onValueChange={(value) => setItemValue(index, { productId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {sortedProducts.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="sm:col-span-2 flex items-end space-x-2">
                      <div className="flex-1">
                        <Label className="text-sm">Quantity</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(event) => setItemValue(index, { quantity: Number(event.target.value) || 1 })}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        disabled={formState.items.length === 1}
                        onClick={() => removeItemRow(index)}
                        aria-label="Remove product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center justify-end space-x-2">
            <Button type="button" variant="outline" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {(createMutation.isPending || updateMutation.isPending) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {editingCombo ? "Save Changes" : "Create Combo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
