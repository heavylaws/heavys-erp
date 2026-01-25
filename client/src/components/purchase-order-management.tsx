import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClipboardList, Plus, Search, X, Eye, Check, Package, Truck, Calendar, ChevronsUpDown, Loader2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { Supplier, Product } from "@shared/schema";
import { useState, useMemo } from "react";

interface PurchaseOrder {
    id: string;
    orderNumber: string;
    supplierId: string;
    status: string;
    subtotal: string;
    tax: string;
    total: string;
    expectedDate?: string;
    receivedDate?: string;
    notes?: string;
    createdAt: string;
    supplier?: Supplier;
    items?: PurchaseOrderItem[];
}

interface PurchaseOrderItem {
    id: string;
    productId: string;
    quantity: number;
    unitCost: string;
    total: string;
    receivedQuantity?: number;
    product?: Product;
}

function ProductCombobox({ value, onChange, products }: { value: string, onChange: (value: string) => void, products: Product[] }) {
    const [open, setOpen] = useState(false);
    const selectedProduct = products.find((p) => p.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedProduct ? selectedProduct.name : "Select product"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command filter={(value, search) => {
                    if (value.toLowerCase().includes(search.toLowerCase())) return 1;
                    return 0;
                }}>
                    <CommandInput placeholder="Search product..." />
                    <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                            {products.map((product) => (
                                <CommandItem
                                    key={product.id}
                                    value={product.name + " " + (product.sku || "") + " " + (product.barcode || "")}
                                    onSelect={() => {
                                        onChange(product.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === product.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {product.name}
                                    {product.sku && <span className="ml-2 text-gray-500 text-xs">({product.sku})</span>}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function CreatePurchaseOrderDialog({ trigger }: { trigger: React.ReactNode }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [selectedSupplier, setSelectedSupplier] = useState("");
    const [expectedDate, setExpectedDate] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<{ productId: string; quantity: number; unitCost: string }[]>([]);
    const [saving, setSaving] = useState(false);

    const { data: suppliers = [] } = useQuery<Supplier[]>({
        queryKey: ["/api/suppliers"],
        enabled: open,
    });

    const { data: products = [] } = useQuery<Product[]>({
        queryKey: ["/api/products"],
        enabled: open,
    });

    const addItem = () => {
        setItems([...items, { productId: "", quantity: 1, unitCost: "0" }]);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const total = useMemo(() => {
        return items.reduce((sum, item) => sum + Number(item.unitCost) * item.quantity, 0);
    }, [items]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedSupplier || items.length === 0) {
            toast({ title: "Error", description: "Please select a supplier and add items", variant: "destructive" });
            return;
        }

        setSaving(true);
        try {
            const response = await apiRequest("POST", "/api/purchase-orders", {
                supplierId: selectedSupplier,
                expectedDate,
                notes,
                items,
            });
            if (!response.ok) throw new Error("Failed to create purchase order");

            queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
            toast({ title: "Success", description: "Purchase order created successfully" });
            setOpen(false);
            setSelectedSupplier("");
            setExpectedDate("");
            setNotes("");
            setItems([]);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                    <DialogDescription>Create a new purchase order to replenish inventory</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') {
                        e.preventDefault();
                    }
                }}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Supplier *</Label>
                                <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((s) => (
                                            <SelectItem key={s.id} value={s.id}>
                                                {s.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Expected Delivery Date</Label>
                                <Input
                                    type="date"
                                    value={expectedDate}
                                    onChange={(e) => setExpectedDate(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Order Items *</Label>
                                <Button type="button" variant="outline" size="sm" onClick={addItem}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    Add Item
                                </Button>
                            </div>

                            {items.length === 0 ? (
                                <div className="text-center py-8 border rounded-lg bg-gray-50">
                                    <Package className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                    <p className="text-gray-500 text-sm">No items added yet</p>
                                    <Button type="button" variant="outline" size="sm" onClick={addItem} className="mt-2">
                                        Add First Item
                                    </Button>
                                </div>
                            ) : (
                                <div className="border rounded-lg overflow-hidden">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Product</TableHead>
                                                <TableHead className="w-24">Quantity</TableHead>
                                                <TableHead className="w-32">Unit Cost</TableHead>
                                                <TableHead className="w-32">Total</TableHead>
                                                <TableHead className="w-16"></TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>
                                                        <ProductCombobox
                                                            value={item.productId}
                                                            onChange={(v) => updateItem(index, "productId", v)}
                                                            products={products}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            value={item.quantity}
                                                            onChange={(e) => updateItem(index, "quantity", parseInt(e.target.value) || 1)}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={item.unitCost}
                                                            onChange={(e) => updateItem(index, "unitCost", e.target.value)}
                                                        />
                                                    </TableCell>
                                                    <TableCell className="font-medium">
                                                        ${(Number(item.unitCost) * item.quantity).toFixed(2)}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => removeItem(index)}
                                                            className="text-red-600"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}

                            {items.length > 0 && (
                                <div className="flex justify-end">
                                    <div className="text-right">
                                        <p className="text-sm text-gray-500">Subtotal</p>
                                        <p className="text-xl font-bold">${total.toFixed(2)}</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <Label>Notes</Label>
                            <Input
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Optional notes for this order..."
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || !selectedSupplier || items.length === 0}>
                            {saving ? "Creating..." : "Create Order"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ReceiveItemsDialog({ order, trigger }: { order: PurchaseOrder; trigger: React.ReactNode }) {
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [receiving, setReceiving] = useState(false);
    const [receiveData, setReceiveData] = useState<{ [itemId: string]: { qty: number; serials: string } }>({});

    const { data: fullOrder, isLoading } = useQuery<PurchaseOrder>({
        queryKey: [`/api/purchase-orders/${order.id}`],
        enabled: open,
    });

    const handleReceive = async () => {
        const items = Object.entries(receiveData)
            .filter(([_, data]) => data.qty > 0)
            .map(([itemId, data]) => ({
                itemId,
                receivedQuantity: data.qty,
                serialNumbers: data.serials ? data.serials.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            }));

        if (items.length === 0) {
            toast({ title: "Error", description: "Please enter quantities to receive", variant: "destructive" });
            return;
        }

        setReceiving(true);
        try {
            const response = await apiRequest("POST", `/api/purchase-orders/${order.id}/receive`, { items });
            if (!response.ok) throw new Error("Failed to receive items");

            queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
            queryClient.invalidateQueries({ queryKey: [`/api/purchase-orders/${order.id}`] });
            toast({ title: "Success", description: "Items received successfully" });
            setOpen(false);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setReceiving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-3xl">
                <DialogHeader>
                    <DialogTitle>Receive Items - {order.orderNumber}</DialogTitle>
                    <DialogDescription>Enter quantities received and serial numbers (if applicable)</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead className="w-20">Ordered</TableHead>
                                    <TableHead className="w-20">Received</TableHead>
                                    <TableHead className="w-24">Receive Qty</TableHead>
                                    <TableHead>Serial Numbers</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {fullOrder?.items?.map((item) => {
                                    const remaining = item.quantity - (item.receivedQuantity || 0);
                                    return (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">
                                                {item.product?.name || "Unknown Product"}
                                                {item.product?.sku && <span className="text-gray-500 ml-1">({item.product.sku})</span>}
                                            </TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.receivedQuantity === item.quantity ? "default" : "secondary"}>
                                                    {item.receivedQuantity || 0}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    max={remaining}
                                                    value={receiveData[item.id]?.qty || 0}
                                                    onChange={(e) =>
                                                        setReceiveData({
                                                            ...receiveData,
                                                            [item.id]: { ...receiveData[item.id], qty: parseInt(e.target.value) || 0 },
                                                        })
                                                    }
                                                    disabled={remaining === 0}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Input
                                                    placeholder="SN1, SN2, SN3..."
                                                    value={receiveData[item.id]?.serials || ""}
                                                    onChange={(e) =>
                                                        setReceiveData({
                                                            ...receiveData,
                                                            [item.id]: { ...receiveData[item.id], serials: e.target.value },
                                                        })
                                                    }
                                                    disabled={remaining === 0}
                                                />
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleReceive} disabled={receiving || isLoading}>
                        <Check className="h-4 w-4 mr-2" />
                        {receiving ? "Processing..." : "Confirm Receipt"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export function PurchaseOrderManagement() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");

    const { data: allOrders = [], isLoading } = useQuery<PurchaseOrder[]>({
        queryKey: ["/api/purchase-orders"],
    });

    const orders = useMemo(() => {
        if (!allOrders) return [];
        let filtered = allOrders;

        if (statusFilter !== "all") {
            filtered = filtered.filter((o) => o.status === statusFilter);
        }

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (o) =>
                    o.orderNumber.toLowerCase().includes(searchLower) ||
                    (o.supplier?.name && o.supplier.name.toLowerCase().includes(searchLower))
            );
        }

        return filtered;
    }, [allOrders, searchTerm, statusFilter]);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "draft":
                return <Badge variant="secondary">Draft</Badge>;
            case "sent":
                return <Badge className="bg-blue-600">Sent</Badge>;
            case "partial":
                return <Badge className="bg-amber-600">Partial</Badge>;
            case "received":
                return <Badge className="bg-green-600">Received</Badge>;
            case "cancelled":
                return <Badge className="bg-red-600">Cancelled</Badge>;
            default:
                return <Badge variant="secondary">{status}</Badge>;
        }
    };

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: string }) => {
            const response = await apiRequest("PUT", `/api/purchase-orders/${id}`, { status });
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/purchase-orders"] });
            toast({ title: "Success", description: "Status updated" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="animate-pulse">
                    <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
                    <div className="space-y-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="h-12 bg-gray-200 rounded"></div>
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
                        <ClipboardList className="h-5 w-5" />
                        <span>Purchase Orders</span>
                    </div>
                    <CreatePurchaseOrderDialog
                        trigger={
                            <Button size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                New Order
                            </Button>
                        }
                    />
                </CardTitle>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label>Search Orders</Label>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                placeholder="Search by PO number, supplier..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-10"
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSearchTerm("")}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                    <div>
                        <Label>Filter by Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="All statuses" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                <SelectItem value="draft">Draft</SelectItem>
                                <SelectItem value="sent">Sent</SelectItem>
                                <SelectItem value="partial">Partial</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {orders.length === 0 ? (
                    <div className="text-center py-8">
                        <ClipboardList className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No purchase orders found</p>
                        <CreatePurchaseOrderDialog
                            trigger={
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Create First Order
                                </Button>
                            }
                        />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Order #</TableHead>
                                <TableHead>Supplier</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Expected</TableHead>
                                <TableHead>Created</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {orders.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell className="font-medium">{order.orderNumber}</TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Truck className="h-4 w-4 text-gray-400" />
                                            {order.supplier?.name || "Unknown"}
                                        </div>
                                    </TableCell>
                                    <TableCell>{getStatusBadge(order.status)}</TableCell>
                                    <TableCell className="font-medium">${parseFloat(order.total).toFixed(2)}</TableCell>
                                    <TableCell>
                                        {order.expectedDate ? (
                                            <div className="flex items-center gap-1 text-sm">
                                                <Calendar className="h-3 w-3 text-gray-400" />
                                                {new Date(order.expectedDate).toLocaleDateString()}
                                            </div>
                                        ) : (
                                            "-"
                                        )}
                                    </TableCell>
                                    <TableCell className="text-sm text-gray-500">
                                        {new Date(order.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end space-x-2">
                                            {order.status === "draft" && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => updateStatusMutation.mutate({ id: order.id, status: "sent" })}
                                                >
                                                    Send
                                                </Button>
                                            )}
                                            {(order.status === "sent" || order.status === "partial") && (
                                                <ReceiveItemsDialog
                                                    order={order}
                                                    trigger={
                                                        <Button variant="outline" size="sm">
                                                            <Package className="h-4 w-4 mr-1" />
                                                            Receive
                                                        </Button>
                                                    }
                                                />
                                            )}
                                            <Button variant="ghost" size="sm">
                                                <Eye className="h-4 w-4" />
                                            </Button>
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
