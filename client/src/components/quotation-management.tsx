import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, FileText, CheckCircle, Printer, ArrowRight, X, Search, User } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ProductSearch } from "@/components/product-search";
import { BarcodeInput } from "@/components/barcode-input";
import type { Product, User as AppUser, Customer } from "@shared/schema";

interface QuoteItem {
    productId: string;
    quantity: number;
    priceAtQuote: number;
    product?: Product;
}

interface Quote {
    id: string;
    customerName: string;
    customerId: string | null;
    totalAmount: number;
    status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'converted';
    createdAt: string;
    validUntil: string | null;
    items: QuoteItem[];
    customer?: Customer;
}

export function QuotationManagement() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingQuote, setEditingQuote] = useState<Quote | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // Quote Builder State
    const [builderCustomer, setBuilderCustomer] = useState<string>("");
    const [builderCustomerName, setBuilderCustomerName] = useState<string>("");
    const [builderItems, setBuilderItems] = useState<QuoteItem[]>([]);
    // Product Search state managed by components

    // Fetch Data
    const { data: quotes = [], isLoading } = useQuery<Quote[]>({
        queryKey: ['/api/v1/quotations'],
    });

    const { data: products = [], isLoading: productsLoading } = useQuery<Product[]>({
        queryKey: ['/api/products'],
    });

    const { data: customers = [] } = useQuery<Customer[]>({
        queryKey: ['/api/customers'],
    });

    // Filtered Products for Picker - REMOVED (Handled by ProductSearch component)
    // const filteredProducts = ...

    // Mutations
    const createQuoteMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest('POST', '/api/v1/quotations', data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/v1/quotations'] });
            setIsDialogOpen(false);
            resetBuilder();
            toast({ title: "Success", description: "Quotation created successfully" });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" })
    });

    const convertMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest('POST', `/api/v1/quotations/${id}/convert`, {});
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/v1/quotations'] });
            toast({ title: "Converted", description: "Quote converted to Order successfully" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest('DELETE', `/api/v1/quotations/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/v1/quotations'] });
            toast({ title: "Deleted", description: "Quote deleted successfully" });
        }
    });

    const resetBuilder = () => {
        setBuilderCustomer("");
        setBuilderCustomerName("");
        setBuilderItems([]);
        setEditingQuote(null);
    };

    const handleAddItem = (product: Product) => {
        setBuilderItems(prev => {
            const existing = prev.find(i => i.productId === product.id);
            if (existing) {
                return prev.map(i => i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i);
            }
            return [...prev, { productId: product.id, quantity: 1, priceAtQuote: Number(product.price), product }];
        });
        // setProductSearch(""); // Handled by components internally
    };

    const calculateTotal = () => {
        return builderItems.reduce((sum, item) => sum + (item.quantity * item.priceAtQuote), 0);
    };

    const handleSave = () => {
        const payload = {
            customerId: builderCustomer === "guest" ? null : builderCustomer,
            customerName: builderCustomer === "guest" ? builderCustomerName : customers.find(c => c.id === builderCustomer)?.name,
            totalAmount: calculateTotal(),
            items: builderItems
        };
        createQuoteMutation.mutate(payload);
    };

    const getStatusBadge = (status: string) => {
        const styles = {
            draft: "bg-gray-100 text-gray-800",
            sent: "bg-blue-100 text-blue-800",
            accepted: "bg-green-100 text-green-800",
            rejected: "bg-red-100 text-red-800",
            converted: "bg-purple-100 text-purple-800"
        };
        return <Badge className={styles[status as keyof typeof styles] || "bg-gray-100"}>{status.toUpperCase()}</Badge>;
    };

    return (
        <Card className="border-none shadow-md">
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Quotations</CardTitle>
                    <CardDescription>Manage customer quotes and convert them to orders</CardDescription>
                </div>
                <Button onClick={() => { resetBuilder(); setIsDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Quote
                </Button>
            </CardHeader>
            <CardContent>
                {/* Quote List */}
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {quotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center text-gray-500 py-8">No quotations found</TableCell>
                            </TableRow>
                        ) : (
                            quotes.map(quote => (
                                <TableRow key={quote.id}>
                                    <TableCell>{format(new Date(quote.createdAt), 'MMM dd, yyyy')}</TableCell>
                                    <TableCell className="font-medium">{quote.customer ? quote.customer.name : quote.customerName || 'Guest'}</TableCell>
                                    <TableCell>${Number(quote.totalAmount).toFixed(2)}</TableCell>
                                    <TableCell>{getStatusBadge(quote.status)}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {quote.status !== 'converted' && (
                                            <Button size="sm" variant="outline" className="text-purple-600 hover:bg-purple-50" onClick={() => convertMutation.mutate(quote.id)} title="Convert to Order">
                                                <ArrowRight className="h-4 w-4" />
                                            </Button>
                                        )}
                                        <Button size="sm" variant="outline" className="text-red-600 hover:bg-red-50" onClick={() => deleteMutation.mutate(quote.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Quote Builder Dialog */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                        <DialogHeader>
                            <DialogTitle>Create Quotation</DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-hidden flex gap-6">
                            <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
                                {/* Customer Selection */}
                                <div className="space-y-2 p-4 border rounded-lg bg-gray-50/50">
                                    <Label>Customer</Label>
                                    <Select value={builderCustomer} onValueChange={setBuilderCustomer}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Customer" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="guest">Guest / Walk-in</SelectItem>
                                            {customers.map(c => (
                                                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    {builderCustomer === 'guest' && (
                                        <Input
                                            placeholder="Enter Guest Name"
                                            value={builderCustomerName}
                                            onChange={e => setBuilderCustomerName(e.target.value)}
                                            className="mt-2"
                                        />
                                    )}
                                </div>

                                {/* Product Picker */}
                                <div className="space-y-4 p-4 border rounded-lg bg-white shadow-sm">
                                    <h3 className="font-semibold text-sm text-gray-900 mb-2">Add Items</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Scan Barcode</Label>
                                            <BarcodeInput
                                                products={products}
                                                onProductAdd={handleAddItem}
                                                placeholder={productsLoading ? "Loading products..." : "Scan or enter barcode..."}
                                                className="w-full"
                                                autoFocus={true}
                                                disabled={productsLoading}
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label>Search Product</Label>
                                            <ProductSearch
                                                products={products}
                                                onProductSelect={handleAddItem}
                                            />
                                        </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                                        <div className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">i</div>
                                        Use barcode scanner or search by name/SKU
                                    </div>
                                </div>

                                {/* Items List */}
                                <div className="space-y-2">
                                    <Label>Items ({builderItems.length})</Label>
                                    <div className="border rounded-md divide-y">
                                        {builderItems.length === 0 && <div className="p-4 text-center text-gray-500 text-sm">No items added</div>}
                                        {builderItems.map((item, idx) => (
                                            <div key={idx} className="p-3 flex items-center justify-between bg-white">
                                                <div className="flex-1">
                                                    <div className="font-medium">{item.product?.name || 'Item'}</div>
                                                    <div className="text-xs text-gray-500">${item.priceAtQuote.toFixed(2)} each</div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Input
                                                        type="number"
                                                        className="w-20 h-8"
                                                        value={item.quantity}
                                                        onChange={(e) => {
                                                            const q = parseInt(e.target.value) || 0;
                                                            setBuilderItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: q } : it));
                                                        }}
                                                    />
                                                    <div className="w-20 text-right font-medium">
                                                        ${(item.quantity * item.priceAtQuote).toFixed(2)}
                                                    </div>
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500" onClick={() => setBuilderItems(prev => prev.filter((_, i) => i !== idx))}>
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Summary Sidebar */}
                            <div className="w-1/3 bg-gray-50 p-6 rounded-lg h-fit border">
                                <h3 className="font-semibold text-lg mb-4">Summary</h3>
                                <div className="space-y-3 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span>${calculateTotal().toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-gray-600">Tax (0%)</span>
                                        <span>$0.00</span>
                                    </div>
                                    <div className="border-t pt-3 mt-3 flex justify-between font-bold text-lg">
                                        <span>Total</span>
                                        <span>${calculateTotal().toFixed(2)}</span>
                                    </div>
                                </div>

                                <Button className="w-full mt-6" size="lg" onClick={handleSave} disabled={createQuoteMutation.isPending || builderItems.length === 0}>
                                    {createQuoteMutation.isPending ? "Creating..." : "Create Quote"}
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}
