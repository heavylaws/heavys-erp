
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Coffee, ShoppingCart, ChevronLeft, Minus, Plus, CreditCard, User, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMobileOptimizations } from "@/components/mobile-optimizations";
import { formatCurrency } from "@/lib/utils";
import { type CompanySettings } from "@shared/schema";

// Types
interface CartItem {
    productId: string;
    name: string;
    price: number;
    quantity: number;
    image?: string;
}

export default function KioskPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    useMobileOptimizations(); // Prevent zoom/scroll issues on touch

    const handleLogout = async () => {
        try {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
            window.location.href = '/';
        } catch (error) {
            window.location.href = '/';
        }
    };

    // State
    const [mode, setMode] = useState<'IDLE' | 'MENU' | 'SUCCESS'>('IDLE');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);

    // Data
    const { data: categories = [] } = useQuery<any[]>({ queryKey: ['/api/categories'] });
    const { data: products = [] } = useQuery<any[]>({ queryKey: ['/api/products'] });
    const { data: settings } = useQuery<CompanySettings>({ queryKey: ['/api/settings/company'] });

    const companyName = settings?.name || "Highway Cafe";

    // Filter products
    const activeProducts = selectedCategory
        ? products.filter((p: any) => p.categoryId === selectedCategory && p.isActive)
        : products.filter((p: any) => p.isActive);

    // Mutations
    const createOrderMutation = useMutation({
        mutationFn: async (orderData: any) => {
            const res = await fetch('/api/orders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderData)
            });
            if (!res.ok) throw new Error('Order failed');
            return res.json();
        },
        onSuccess: (data) => {
            setMode('SUCCESS');
            setCart([]);
            setIsCartOpen(false);
            // Auto-reset after 10 seconds
            setTimeout(() => setMode('IDLE'), 10000);
        },
        onError: () => {
            toast({ title: "Order Failed", description: "Please ask a staff member for help.", variant: "destructive" });
        }
    });

    // Helpers
    const addToCart = (product: any) => {
        setCart(prev => {
            const existing = prev.find(item => item.productId === product.id);
            if (existing) {
                return prev.map(item => item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item);
            }
            return [...prev, { productId: product.id, name: product.name, price: Number(product.price), quantity: 1 }];
        });
        toast({ title: "Added to Cart!", description: product.name, duration: 1000 });
    };

    const removeFromCart = (productId: string) => {
        setCart(prev => prev.reduce((acc: CartItem[], item) => {
            if (item.productId === productId) {
                if (item.quantity > 1) return [...acc, { ...item, quantity: item.quantity - 1 }];
                return acc;
            }
            return [...acc, item];
        }, []));
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const handleCheckout = () => {
        if (cart.length === 0) return;

        createOrderMutation.mutate({
            items: cart.map(i => ({
                productId: i.productId,
                quantity: i.quantity,
                price: i.price.toString() // API expects string
            })),
            paymentMethod: 'cash', // Default to Pay at Counter
            status: 'pending',
            subtotal: cartTotal.toFixed(2),
            tax: (cartTotal * 0.1).toFixed(2), // Approx tax
            total: (cartTotal * 1.1).toFixed(2),
            isDelivery: false,
            notes: "KIOSK ORDER"
        });
    };

    // Render
    if (mode === 'IDLE') {
        return (
            <div
                className="h-screen w-screen bg-gradient-to-br from-indigo-900 to-purple-800 flex flex-col items-center justify-center text-white cursor-pointer"
                onClick={() => setMode('MENU')}
            >
                <div className="animate-bounce mb-8">
                    <Coffee className="w-32 h-32 text-yellow-400" />
                </div>
                <h1 className="text-6xl font-bold mb-4">{companyName}</h1>
                <p className="text-2xl opacity-80">Tap to Start Order</p>
                <div className="mt-12 text-sm opacity-50">Self-Service Terminal #1</div>
            </div>
        );
    }

    if (mode === 'SUCCESS') {
        return (
            <div className="h-screen w-screen bg-green-600 flex flex-col items-center justify-center text-white p-8 text-center">
                <div className="bg-white text-green-600 rounded-full p-6 mb-8">
                    <Coffee className="w-20 h-20" />
                </div>
                <h1 className="text-5xl font-bold mb-4">Order Placed!</h1>
                <p className="text-2xl mb-8">Please pay at the counter.</p>
                <div className="bg-white/20 p-6 rounded-xl">
                    <p className="text-xl">Order Number</p>
                    <p className="text-6xl font-mono font-bold mt-2">#{createOrderMutation.data?.orderNumber || '...'}</p>
                </div>
                <Button
                    className="mt-12 bg-white text-green-800 hover:bg-green-100 text-xl px-12 py-8 rounded-full"
                    onClick={() => setMode('IDLE')}
                >
                    New Order
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <header className="bg-white p-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" className="h-12 w-12 rounded-full" onClick={() => setMode('IDLE')}>
                        <ChevronLeft className="h-8 w-8" />
                    </Button>
                    <h1 className="text-xl font-bold">Menu</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* Hidden Admin Exit */}
                    <Button variant="ghost" className="text-gray-300 hover:text-red-500" onClick={handleLogout}>
                        <User className="h-4 w-4" />
                    </Button>
                </div>
            </header>

            {/* Category Tabs */}
            <div className="bg-white border-b overflow-x-auto py-4 px-4 flex gap-2 sticky top-[72px] z-10">
                <Button
                    variant={selectedCategory === null ? "default" : "outline"}
                    className="rounded-full px-6 h-12 text-lg"
                    onClick={() => setSelectedCategory(null)}
                >
                    All Items
                </Button>
                {categories.map((c: any) => (
                    <Button
                        key={c.id}
                        variant={selectedCategory === c.id ? "default" : "outline"}
                        className="rounded-full px-6 h-12 text-lg"
                        onClick={() => setSelectedCategory(c.id)}
                    >
                        {c.name}
                    </Button>
                ))}
            </div>

            {/* Product Grid */}
            <main className="flex-1 p-6 overflow-y-auto pb-32">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {activeProducts.map((product: any) => (
                        <Card
                            key={product.id}
                            className="overflow-hidden cursor-pointer active:scale-95 transition-transform"
                            onClick={() => addToCart(product)}
                        >
                            <div className="aspect-square bg-gray-200 flex items-center justify-center">
                                <Coffee className="h-16 w-16 text-gray-400" />
                            </div>
                            <CardContent className="p-4">
                                <h3 className="font-bold text-lg leading-tight mb-2 h-14 line-clamp-2">{product.name}</h3>
                                <div className="flex justify-between items-center">
                                    <span className="font-bold text-primary text-xl">{formatCurrency(Number(product.price))}</span>
                                    <Button size="icon" className="rounded-full h-8 w-8">
                                        <Plus className="h-5 w-5" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </main>

            {/* Floating Cart Button / Bottom Sheet */}
            <div className="fixed bottom-0 left-0 right-0 p-4 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex-1">
                        <p className="text-gray-500 text-sm">Total</p>
                        <p className="text-3xl font-bold text-primary">{formatCurrency(cartTotal)}</p>
                    </div>

                    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
                        <SheetTrigger asChild>
                            <Button className="h-16 px-8 rounded-full text-xl gap-3 shadow-lg" disabled={cart.length === 0}>
                                <ShoppingCart className="h-6 w-6" />
                                View Order ({cart.reduce((a, b) => a + b.quantity, 0)})
                            </Button>
                        </SheetTrigger>
                        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col">
                            <SheetHeader>
                                <SheetTitle className="text-2xl">Your Order</SheetTitle>
                            </SheetHeader>

                            <div className="flex-1 overflow-y-auto py-6 space-y-4">
                                {cart.length === 0 ? (
                                    <div className="text-center text-gray-500 mt-20">Cart is empty</div>
                                ) : (
                                    cart.map(item => (
                                        <div key={item.productId} className="flex items-center justify-between bg-gray-50 p-4 rounded-lg">
                                            <div className="flex-1">
                                                <p className="font-bold text-lg">{item.name}</p>
                                                <p className="text-gray-500">{formatCurrency(item.price)}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => removeFromCart(item.productId)}>
                                                    <Minus className="h-4 w-4" />
                                                </Button>
                                                <span className="w-6 text-center font-bold text-lg">{item.quantity}</span>
                                                <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => addToCart({ id: item.productId, name: item.name, price: item.price })}>
                                                    <Plus className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div className="border-t pt-4 space-y-4">
                                <div className="flex justify-between text-xl font-bold">
                                    <span>Total</span>
                                    <span>{formatCurrency(cartTotal)}</span>
                                </div>
                                <Button
                                    className="w-full h-16 text-xl rounded-xl"
                                    disabled={cart.length === 0 || createOrderMutation.isPending}
                                    onClick={handleCheckout}
                                >
                                    {createOrderMutation.isPending ? "Placing Order..." : "Place Order & Pay at Counter"}
                                </Button>
                            </div>
                        </SheetContent>
                    </Sheet>
                </div>
            </div>
        </div>
    );
}
