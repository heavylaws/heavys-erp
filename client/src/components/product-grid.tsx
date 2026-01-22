import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Coffee } from "lucide-react";
import type { Product } from "@shared/schema";
import { formatDualCurrency } from "@shared/currency-utils";
import { useQuery } from "@tanstack/react-query";
import { useExchangeRate } from '@/hooks/useExchangeRate';

interface ProductGridProps {
  products: Product[];
  onProductSelect: (product: Product) => void;
}

export function ProductGrid({ products, onProductSelect }: ProductGridProps) {
  // Fetch current exchange rate for dual currency display
  const { data: currentRate } = useExchangeRate();

  if (products.length === 0) {
    return (
      <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 sm:gap-3">
        <div className="col-span-full text-center py-12">
          <Coffee className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No products available in this category</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3">
      {products.map((product) => (
        <Card
          key={product.id}
          className={`cursor-pointer hover:shadow-md transition-shadow touch-target ${Number(product.stockQuantity) <= Number(product.minThreshold)
            ? 'border-2 border-red-200 bg-red-50'
            : ''
            }`}
          onClick={() => onProductSelect(product)}
        >
          <CardContent className="p-2 sm:p-2.5">
            <div className="aspect-square bg-gray-100 rounded-md mb-2 flex items-center justify-center">
              <Coffee className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <h3 className="font-medium text-neutral text-sm mb-0.5 line-clamp-2 leading-tight">{product.name}</h3>
              </TooltipTrigger>
              <TooltipContent side="top">
                <div className="font-medium">{product.name}</div>
              </TooltipContent>
            </Tooltip>
            <p className="text-[11px] text-gray-600 mb-0.5 line-clamp-2 leading-snug">{product.description}</p>
            {/* Barcode is now shown in tooltip to preserve space; remove barcode line under name */}
            <div className="flex flex-col">
              <div className="flex items-center justify-between mb-0.5">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-primary leading-none">
                    {currentRate && (currentRate as any).rate ?
                      formatDualCurrency(parseFloat(product.price), parseFloat((currentRate as any).rate)) :
                      `$${product.price}`
                    }
                  </span>
                </div>
                <div className="text-[10px]">
                  {Number(product.stockQuantity) <= Number(product.minThreshold) ? (
                    <Badge variant="destructive">{product.stockQuantity} left!</Badge>
                  ) : (
                    <span className="text-gray-500">{product.stockQuantity} left</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
