import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import type { Product } from '@shared/schema';

interface OptionGroupWithOptions {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  minSelections: number | null;
  maxSelections: number | null;
  options: Array<{
    id: string;
    name: string;
    priceAdjust: string | number | null;
    isActive: boolean;
  }>;
}

interface OptionalIngredientWithMeta {
  recipeIngredientId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: string;
  unit: string | null;
  stockQuantity: string;
  minThreshold: string;
}

export interface OptionalIngredientSelection {
  recipeIngredientId: string;
  ingredientId: string;
  name: string;
  quantity: string;
  unit: string | null;
}

export interface OptionSelectorSelection {
  options: Array<{ id: string; name: string; priceAdjust: number }>;
  optionalIngredients: OptionalIngredientSelection[];
}

interface OptionSelectorProps {
  product: Product | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (selection: OptionSelectorSelection) => void;
  enabled: boolean; // feature flag
}

export function OptionSelector({ product, open, onClose, onConfirm, enabled }: OptionSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [groups, setGroups] = useState<OptionGroupWithOptions[]>([]);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({}); // groupId -> optionIds
  const [error, setError] = useState<string | null>(null);
  const [optionalIngredients, setOptionalIngredients] = useState<OptionalIngredientWithMeta[]>([]);
  const [optionalSelected, setOptionalSelected] = useState<Set<string>>(new Set());
  const [optionalSearch, setOptionalSearch] = useState('');

  const formatOptionalName = (ing: { ingredientName: string; quantity: string; unit: string | null }) => {
    const qty = ing.quantity ? parseFloat(ing.quantity) : NaN;
    const hasQty = !isNaN(qty) && qty > 0;
    if (hasQty) {
      return `${ing.ingredientName} (${Number(qty.toFixed(3))}${ing.unit ? ` ${ing.unit}` : ''})`;
    }
    return ing.ingredientName;
  };

  useEffect(() => {
    if (!(open && product && enabled)) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    let optionLoadError: string | null = null;

    const loadOptionGroups = fetch(`/api/products/${product.id}/options`, { credentials: 'include' })
      .then((r) => {
        if (!r.ok) {
          throw new Error('Failed to load options');
        }
        return r.json();
      })
  .then((data) => (Array.isArray(data) ? data : []))
      .catch((e) => {
        console.warn('Option load failed', e);
        optionLoadError = 'Could not load options';
        return [] as OptionGroupWithOptions[];
      });

    const loadOptionalIngredients = fetch(`/api/products/${product.id}/optional-ingredients`, { credentials: 'include' })
      .then((r) => {
        if (r.status === 404) return [];
        if (!r.ok) {
          throw new Error('Failed to load optional ingredients');
        }
        return r.json();
      })
      .then((data) => (Array.isArray(data) ? data : []))
      .catch((e) => {
        console.warn('Optional ingredient load failed', e);
        return [] as OptionalIngredientWithMeta[];
      });

    Promise.all([loadOptionGroups, loadOptionalIngredients])
      .then(([groupData, optionalData]) => {
        if (cancelled) return;

        const gs: OptionGroupWithOptions[] = Array.isArray(groupData) ? groupData : [];
        setGroups(gs);

        const init: Record<string, Set<string>> = {};
        gs.forEach((g) => {
          init[g.id] = new Set();
        });
        setSelected(init);

        const optionalList: OptionalIngredientWithMeta[] = Array.isArray(optionalData) ? optionalData : [];
        setOptionalIngredients(optionalList);
        setOptionalSelected(new Set());
        setOptionalSearch('');

        setError(optionLoadError);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, product, enabled]);

  useEffect(() => {
    if (!open) {
      setOptionalSelected(new Set());
      setOptionalSearch('');
    }
  }, [open]);

  const toggleOption = (groupId: string, optionId: string, selectionType: string, maxSelections: number | null) => {
    setSelected(prev => {
      const next: Record<string, Set<string>> = { ...prev };
      const current = new Set(next[groupId] || []);
      if (selectionType === 'single') {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          current.clear();
          current.add(optionId);
        }
      } else {
        if (current.has(optionId)) {
          current.delete(optionId);
        } else {
          if (maxSelections === null || current.size < maxSelections) {
            current.add(optionId);
          }
        }
      }
      next[groupId] = current;
      return next;
    });
  };

  const toggleOptional = (recipeIngredientId: string) => {
    setOptionalSelected((prev) => {
      const next = new Set(prev);
      if (next.has(recipeIngredientId)) {
        next.delete(recipeIngredientId);
      } else {
        next.add(recipeIngredientId);
      }
      return next;
    });
  };

  const validate = () => {
    for (const g of groups) {
      const sel = selected[g.id] || new Set();
      if (g.isRequired && sel.size === 0) return false;
      if (g.minSelections !== null && sel.size < g.minSelections) return false;
      if (g.maxSelections !== null && sel.size > g.maxSelections) return false;
    }
    return true;
  };

  const handleConfirm = () => {
    if (!validate()) {
      setError('Please satisfy all option requirements');
      return;
    }
    const selectedOptions: { id: string; name: string; priceAdjust: number }[] = [];
    groups.forEach(g => {
      const setIds = selected[g.id] || new Set();
      g.options.forEach(o => {
        if (setIds.has(o.id)) {
          selectedOptions.push({ id: o.id, name: o.name, priceAdjust: o.priceAdjust ? parseFloat(o.priceAdjust as any) : 0 });
        }
      });
    });
    const optionalSelectedList: OptionalIngredientSelection[] = optionalIngredients
      .filter((ing) => optionalSelected.has(ing.recipeIngredientId))
      .map((ing) => ({
        recipeIngredientId: ing.recipeIngredientId,
        ingredientId: ing.ingredientId,
        name: ing.ingredientName,
        quantity: ing.quantity,
        unit: ing.unit,
      }));

    onConfirm({ options: selectedOptions, optionalIngredients: optionalSelectedList });
    onClose();
  };

  const normalizedOptionalSearch = optionalSearch.trim().toLowerCase();
  const filteredOptionalIngredients = normalizedOptionalSearch
    ? optionalIngredients.filter((ing) =>
        ing.ingredientName.toLowerCase().includes(normalizedOptionalSearch)
      )
    : optionalIngredients;
  const optionalSummaryLabels = optionalIngredients
    .filter((ing) => optionalSelected.has(ing.recipeIngredientId))
    .map(formatOptionalName);

  // If feature disabled or no product, render nothing
  if (!open || !product || !enabled) return null;

  return (
    <Dialog open={open} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Options - {product.name}</DialogTitle>
        </DialogHeader>
        {loading && <div className="text-sm text-gray-500">Loading options...</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div className="space-y-6">
          <div className="space-y-4">
            {groups.length === 0 && !loading && (
              <div className="text-sm text-gray-500">No option groups available for this product.</div>
            )}
            {groups.map(group => {
              const sel = selected[group.id] || new Set();
              return (
                <div key={group.id} className="border rounded-md p-3 bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h4 className="font-semibold text-sm">{group.name}</h4>
                      <div className="text-xs text-gray-600">
                        {group.selectionType === 'single' ? 'Choose 0 or 1' : 'Multiple allowed'}
                        {group.minSelections !== null && ` • Min ${group.minSelections}`}
                        {group.maxSelections !== null && ` • Max ${group.maxSelections}`}
                        {group.isRequired && ' • Required'}
                      </div>
                    </div>
                    <Badge variant={sel.size > 0 ? 'secondary' : 'outline'}>{sel.size} selected</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {group.options.filter(o => o.isActive).map(opt => {
                      const active = sel.has(opt.id);
                      const priceAdj = opt.priceAdjust ? parseFloat(opt.priceAdjust as any) : 0;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleOption(group.id, opt.id, group.selectionType, group.maxSelections)}
                          className={`text-xs px-2 py-1 rounded border transition ${active ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-gray-100'} disabled:opacity-50`}
                        >
                          {opt.name}{priceAdj !== 0 && ` (${priceAdj > 0 ? '+' : ''}$${priceAdj.toFixed(2)})`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-semibold text-sm">Optional Ingredients</h4>
                <div className="text-xs text-gray-600">Toggle extra ingredients to deduct stock and note in the order.</div>
              </div>
              <Badge variant={optionalSelected.size > 0 ? 'secondary' : 'outline'}>{optionalSelected.size} selected</Badge>
            </div>
            {optionalIngredients.length === 0 ? (
              <div className="text-xs text-gray-500">No optional ingredients configured in the recipe.</div>
            ) : (
              <div className="space-y-3">
                <Input
                  type="search"
                  value={optionalSearch}
                  onChange={(e) => setOptionalSearch(e.target.value)}
                  placeholder="Search optional ingredients..."
                  className="h-8 text-xs"
                />
                <div className="flex flex-wrap gap-2">
                  {filteredOptionalIngredients.length === 0 && (
                    <div className="text-xs text-gray-500">No ingredients match “{optionalSearch}”.</div>
                  )}
                  {filteredOptionalIngredients.map((ing) => {
                    const active = optionalSelected.has(ing.recipeIngredientId);
                    const label = formatOptionalName(ing);
                    return (
                      <button
                        key={ing.recipeIngredientId}
                        type="button"
                        onClick={() => toggleOptional(ing.recipeIngredientId)}
                        className={`text-xs px-2 py-1 rounded border transition ${active ? 'bg-primary text-white border-primary' : 'bg-white hover:bg-gray-100'}`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Summary */}
        {(groups.length > 0 || optionalIngredients.length > 0) && (
          <div className="mt-4 p-3 rounded bg-gray-100 text-xs space-y-1">
            <div className="font-semibold">Selection Summary</div>
            {groups.map(g => {
              const sel = selected[g.id] || new Set();
              if (sel.size === 0) return null;
              const lines: string[] = [];
              g.options.forEach(o => { if (sel.has(o.id)) lines.push(`${o.name}${o.priceAdjust ? ` (${parseFloat(o.priceAdjust as any) >=0 ? '+' : ''}$${parseFloat(o.priceAdjust as any).toFixed(2)})` : ''}`); });
              return <div key={g.id}>{g.name}: {lines.join(', ')}</div>;
            })}
            {optionalSummaryLabels.length > 0 && (
              <div>Optional: {optionalSummaryLabels.join(', ')}</div>
            )}
            <div className="pt-1 border-t border-gray-300">
              Total Adj: ${(() => {
                let sum = 0;
                groups.forEach(g => {
                  const selSet = selected[g.id] || new Set();
                  g.options.forEach(o => { if (selSet.has(o.id) && o.priceAdjust) sum += parseFloat(o.priceAdjust as any); });
                });
                return sum.toFixed(2);
              })()}
            </div>
          </div>
        )}
        <DialogFooter className="mt-4 flex items-center justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!validate()}>Add to Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
