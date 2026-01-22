import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, Package, Maximize2, Minimize2 } from "lucide-react";
import type { Product } from "@shared/schema";
import { useExchangeRate } from "@/hooks/useExchangeRate";

export default function PriceCheck() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const { rate, secondaryCurrency, primaryCurrency } = useExchangeRate();

    // Auto-clear after 15 seconds of showing a product
    useEffect(() => {
        if (selectedProduct) {
            const timer = setTimeout(() => {
                setSelectedProduct(null);
                setSearchTerm("");
                inputRef.current?.focus();
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, [selectedProduct]);

    // Auto-focus input on mount
    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const { data: products = [] } = useQuery<Product[]>({
        queryKey: ["/api/products"],
    });

    // Filter products by search (name or barcode)
    const filteredProducts = searchTerm.length >= 2
        ? products.filter(
            (p) =>
                p.isActive &&
                (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (p.barcode && p.barcode.includes(searchTerm)) ||
                    (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())))
        ).slice(0, 8)
        : [];

    // Handle barcode scan (fast input - exact match)
    useEffect(() => {
        if (searchTerm.length > 5) {
            const exactMatch = products.find(
                (p) => p.isActive && (p.barcode === searchTerm || p.sku === searchTerm)
            );
            if (exactMatch) {
                setSelectedProduct(exactMatch);
            }
        }
    }, [searchTerm, products]);

    const handleSelect = (product: Product) => {
        setSelectedProduct(product);
        setSearchTerm("");
    };

    const handleClear = () => {
        setSelectedProduct(null);
        setSearchTerm("");
        inputRef.current?.focus();
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const formatPrice = (price: number) => {
        const priceInSecondary = price * rate;
        return {
            primary: `${primaryCurrency} ${price.toFixed(2)}`,
            secondary: `${secondaryCurrency} ${priceInSecondary.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        };
    };

    return (
        <div
            ref={containerRef}
            className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-8"
        >
            {/* Fullscreen Toggle */}
            <div className="absolute top-4 right-4">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFullscreen}
                    className="text-white/60 hover:text-white"
                >
                    {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </Button>
            </div>

            <div className="w-full max-w-2xl space-y-8">
                {/* Title */}
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-white mb-2">💲 Price Check</h1>
                    <p className="text-slate-400">Scan barcode or search for product</p>
                </div>

                {/* Search Box */}
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-6 w-6 text-slate-400" />
                    <Input
                        ref={inputRef}
                        type="text"
                        placeholder="Enter product name or scan barcode..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-14 pr-12 py-6 text-xl bg-white/10 border-white/20 text-white placeholder:text-slate-500 rounded-xl focus:bg-white/20 focus:ring-2 focus:ring-emerald-500"
                        autoFocus
                    />
                    {searchTerm && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleClear}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    )}
                </div>

                {/* Search Results */}
                {!selectedProduct && filteredProducts.length > 0 && (
                    <Card className="bg-white/10 backdrop-blur border-white/20">
                        <CardContent className="p-2">
                            {filteredProducts.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => handleSelect(product)}
                                    className="w-full p-4 text-left hover:bg-white/10 rounded-lg transition-colors flex items-center justify-between"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-white/10 p-3 rounded-lg">
                                            <Package className="h-6 w-6 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium text-lg">{product.name}</div>
                                            {product.sku && (
                                                <div className="text-slate-400 text-sm">SKU: {product.sku}</div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-emerald-400 font-bold text-xl">
                                            {formatPrice(Number(product.price)).primary}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </CardContent>
                    </Card>
                )}

                {/* Selected Product Display */}
                {selectedProduct && (
                    <Card className="bg-white/10 backdrop-blur border-white/20 overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                        <CardContent className="p-8">
                            <div className="text-center space-y-6">
                                {/* Product Icon */}
                                <div className="mx-auto w-24 h-24 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/30">
                                    <Package className="h-12 w-12 text-white" />
                                </div>

                                {/* Product Name */}
                                <div>
                                    <h2 className="text-3xl font-bold text-white mb-2">
                                        {selectedProduct.name}
                                    </h2>
                                    {selectedProduct.sku && (
                                        <p className="text-slate-400">SKU: {selectedProduct.sku}</p>
                                    )}
                                    {selectedProduct.manufacturer && (
                                        <p className="text-slate-400">{selectedProduct.manufacturer}</p>
                                    )}
                                </div>

                                {/* Price Display - Dual Currency */}
                                <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-6 space-y-2 shadow-lg">
                                    <div className="text-5xl font-bold text-white">
                                        {formatPrice(Number(selectedProduct.price)).primary}
                                    </div>
                                    <div className="text-2xl text-white/80">
                                        {formatPrice(Number(selectedProduct.price)).secondary}
                                    </div>
                                </div>

                                {/* Stock & Warranty */}
                                <div className="flex justify-center gap-4 flex-wrap">
                                    {Number(selectedProduct.stockQuantity) > 0 ? (
                                        <span className="px-4 py-2 bg-emerald-500/20 text-emerald-400 rounded-full text-sm font-medium">
                                            ✓ In Stock
                                        </span>
                                    ) : (
                                        <span className="px-4 py-2 bg-red-500/20 text-red-400 rounded-full text-sm font-medium">
                                            Out of Stock
                                        </span>
                                    )}
                                    {selectedProduct.warrantyMonths && selectedProduct.warrantyMonths > 0 && (
                                        <span className="px-4 py-2 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium">
                                            🛡️ {selectedProduct.warrantyMonths}mo Warranty
                                        </span>
                                    )}
                                </div>

                                {/* Clear Button */}
                                <Button
                                    onClick={handleClear}
                                    variant="outline"
                                    className="mt-4 border-white/20 text-white hover:bg-white/10"
                                >
                                    Check Another Product
                                </Button>

                                <p className="text-slate-500 text-sm">
                                    Auto-clears in 15 seconds
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State */}
                {!selectedProduct && searchTerm.length < 2 && (
                    <div className="text-center text-slate-500 py-12">
                        <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-xl">Scan a barcode or type to search</p>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="absolute bottom-4 text-slate-600 text-sm">
                Heavy's ERP • Price Check Kiosk
            </div>
        </div>
    );
}
