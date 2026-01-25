import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Edit, Trash2, Users, Plus, Search, X, Phone, Mail, Building, User } from "lucide-react";
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import type { Customer } from "@shared/schema";
import { useState, useMemo } from "react";

interface CustomerFormData {
    name: string;
    type: "retail" | "wholesale" | "corporate";
    email: string;
    phone: string;
    address: string;
    taxId: string;
    creditLimit: string;
    paymentTerms: string;
    notes: string;
}

const emptyForm: CustomerFormData = {
    name: "",
    type: "retail",
    email: "",
    phone: "",
    address: "",
    taxId: "",
    creditLimit: "",
    paymentTerms: "",
    notes: "",
};

function CustomerFormDialog({
    customer,
    trigger,
    onSave,
}: {
    customer?: Customer;
    trigger: React.ReactNode;
    onSave: (data: CustomerFormData) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<CustomerFormData>(
        customer
            ? {
                name: customer.name,
                type: (customer.type as "retail" | "wholesale" | "corporate") || "retail",
                email: customer.email || "",
                phone: customer.phone || "",
                address: customer.address || "",
                taxId: customer.taxId || "",
                creditLimit: customer.creditLimit || "",
                paymentTerms: customer.paymentTerms || "",
                notes: customer.notes || "",
            }
            : emptyForm
    );
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await onSave(form);
            setOpen(false);
            if (!customer) setForm(emptyForm);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
                    <DialogDescription>
                        {customer ? "Update customer information" : "Enter the details for the new customer"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Customer Name *</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    placeholder="John Doe / ABC Corp"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="type">Customer Type</Label>
                                <Select
                                    value={form.type}
                                    onValueChange={(v) => setForm({ ...form, type: v as CustomerFormData["type"] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="retail">Retail (B2C)</SelectItem>
                                        <SelectItem value="wholesale">Wholesale</SelectItem>
                                        <SelectItem value="corporate">Corporate (B2B)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+1 555-0123"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="customer@email.com"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="123 Main Street, City, Country"
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="taxId">Tax ID</Label>
                                <Input
                                    id="taxId"
                                    value={form.taxId}
                                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                                    placeholder="123-45-6789"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="creditLimit">Credit Limit</Label>
                                <Input
                                    id="creditLimit"
                                    type="number"
                                    value={form.creditLimit}
                                    onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
                                    placeholder="5000.00"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="paymentTerms">Payment Terms</Label>
                            <Input
                                id="paymentTerms"
                                value={form.paymentTerms}
                                onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })}
                                placeholder="Net 30"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                placeholder="Additional information..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || !form.name}>
                            {saving ? "Saving..." : customer ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function CustomerManagement() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [typeFilter, setTypeFilter] = useState<string>("all");

    const { data: allCustomers = [], isLoading } = useQuery<Customer[]>({
        queryKey: ["/api/customers"],
    });

    const customers = useMemo(() => {
        if (!allCustomers) return [];
        let filtered = allCustomers;

        if (typeFilter !== "all") {
            filtered = filtered.filter((c) => c.type === typeFilter);
        }

        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (c) =>
                    c.name.toLowerCase().includes(searchLower) ||
                    (c.email && c.email.toLowerCase().includes(searchLower)) ||
                    (c.phone && c.phone.includes(searchTerm))
            );
        }

        return filtered;
    }, [allCustomers, searchTerm, typeFilter]);

    const createMutation = useMutation({
        mutationFn: async (data: CustomerFormData) => {
            const response = await apiRequest("POST", "/api/customers", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            toast({ title: "Success", description: "Customer created successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
            const response = await apiRequest("PUT", `/api/customers/${id}`, data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            toast({ title: "Success", description: "Customer updated successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiRequest("DELETE", `/api/customers/${id}`);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
            toast({ title: "Success", description: "Customer deactivated successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const getTypeBadge = (type: string) => {
        switch (type) {
            case "retail":
                return <Badge className="bg-blue-600">Retail</Badge>;
            case "wholesale":
                return <Badge className="bg-purple-600">Wholesale</Badge>;
            case "corporate":
                return <Badge className="bg-amber-600">Corporate</Badge>;
            default:
                return <Badge variant="secondary">{type}</Badge>;
        }
    };

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
                        <Users className="h-5 w-5" />
                        <span>Customer Management</span>
                    </div>
                    <CustomerFormDialog
                        trigger={
                            <Button size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Customer
                            </Button>
                        }
                        onSave={async (data) => {
                            await createMutation.mutateAsync(data);
                        }}
                    />
                </CardTitle>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="customer-search">Search Customers</Label>
                        <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                            <Input
                                id="customer-search"
                                placeholder="Search by name, email, phone..."
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
                        <Label>Filter by Type</Label>
                        <Select value={typeFilter} onValueChange={setTypeFilter}>
                            <SelectTrigger className="mt-2">
                                <SelectValue placeholder="All types" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                <SelectItem value="retail">Retail</SelectItem>
                                <SelectItem value="wholesale">Wholesale</SelectItem>
                                <SelectItem value="corporate">Corporate</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {(searchTerm || typeFilter !== "all") && allCustomers && (
                    <div className="mt-2">
                        <Badge variant="outline" className="bg-blue-50">
                            Showing {customers?.length || 0} of {allCustomers.length} customers
                        </Badge>
                    </div>
                )}
            </CardHeader>
            <CardContent>
                {customers.length === 0 ? (
                    <div className="text-center py-8">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No customers found</p>
                        <CustomerFormDialog
                            trigger={
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add First Customer
                                </Button>
                            }
                            onSave={async (data) => {
                                await createMutation.mutateAsync(data);
                            }}
                        />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Customer</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Credit</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {customers.map((customer) => (
                                <TableRow key={customer.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-blue-100 p-2 rounded-lg">
                                                {customer.type === "corporate" ? (
                                                    <Building className="h-4 w-4 text-blue-600" />
                                                ) : (
                                                    <User className="h-4 w-4 text-blue-600" />
                                                )}
                                            </div>
                                            <div>
                                                <div className="font-medium">{customer.name}</div>
                                                {customer.taxId && (
                                                    <div className="text-sm text-gray-500">Tax: {customer.taxId}</div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{getTypeBadge(customer.type || "retail")}</TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {customer.phone && (
                                                <div className="text-sm flex items-center gap-1">
                                                    <Phone className="h-3 w-3 text-gray-400" />
                                                    {customer.phone}
                                                </div>
                                            )}
                                            {customer.email && (
                                                <div className="text-sm flex items-center gap-1">
                                                    <Mail className="h-3 w-3 text-gray-400" />
                                                    {customer.email}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {customer.creditLimit ? (
                                            <div>
                                                <div className="font-medium">${parseFloat(customer.creditLimit).toFixed(2)}</div>
                                                {customer.currentBalance && parseFloat(customer.currentBalance) > 0 && (
                                                    <div className="text-xs text-orange-600">
                                                        Balance: ${parseFloat(customer.currentBalance).toFixed(2)}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={customer.isActive ? "bg-green-600" : "bg-gray-400"}>
                                            {customer.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end space-x-2">
                                            <CustomerFormDialog
                                                customer={customer}
                                                trigger={
                                                    <Button variant="ghost" size="sm">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                }
                                                onSave={async (data) => {
                                                    await updateMutation.mutateAsync({ id: customer.id, data });
                                                }}
                                            />

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Deactivate Customer</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to deactivate "{customer.name}"? Their transaction history will be preserved.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteMutation.mutate(customer.id)}
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Deactivate
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
