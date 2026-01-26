import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, X, Coffee } from "lucide-react";
import { formatDualCurrency } from "@shared/currency-utils";
import type { Product } from "@shared/schema";
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface ProductSearchProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
  currentRate?: number;
}

export function ProductSearch({ products, onProductSelect, currentRate }: ProductSearchProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [showResults, setShowResults] = useState(false);
  const { data: exchangeRate } = useExchangeRate();

  const displayRate = typeof currentRate === 'number' ? currentRate : (exchangeRate?.rate ? parseFloat(String(exchangeRate.rate)) : undefined);

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const term = searchTerm.toLowerCase().trim();
      const filtered = products.filter(product =>
        product.name.toLowerCase().includes(term) ||
        product.description?.toLowerCase().includes(term) ||
        product.barcode?.toLowerCase().includes(term) ||
        product.barcodes?.some(b => b.toLowerCase().includes(term))
      );
      setFilteredProducts(filtered.slice(0, 8)); // Limit to 8 results
      setShowResults(true);
    } else {
      setFilteredProducts([]);
      setShowResults(false);
    }
  }, [searchTerm, products]);

  const handleProductSelect = (product: Product) => {
    onProductSelect(product);
    setSearchTerm("");
    setShowResults(false);
  };

  const clearSearch = () => {
    setSearchTerm("");
    setShowResults(false);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Search products..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-10"
          autoComplete="off"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {showResults && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto shadow-lg">
          <CardContent className="p-2">
            {filteredProducts.length > 0 ? (
              <div className="space-y-1">
                {filteredProducts.map((product) => (
                  <button
                    key={product.id}
                    onClick={() => handleProductSelect(product)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <div className="h-8 w-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 border border-gray-200 overflow-hidden flex-shrink-0">
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
                          <h4 className="font-medium text-gray-900 truncate">{product.name}</h4>
                        </div>
                        {product.description && (
                          <p className="text-sm text-gray-600 truncate mt-1">{product.description}</p>
                        )}
                        {/* Barcode suppressed from UI */}
                      </div>
                      <div className="text-right ml-4">
                        <div className="font-semibold text-gray-900">
                          {formatDualCurrency(parseFloat(product.price), displayRate ?? 0)}
                        </div>
                        {product.categoryId && (
                          <Badge variant="outline" className="text-xs mt-1">
                            Category ID: {product.categoryId}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-6">
                <Search className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">No products found</p>
                <p className="text-xs text-gray-400 mt-1">Try a different search term</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}