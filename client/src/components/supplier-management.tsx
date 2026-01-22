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
import { Edit, Trash2, Truck, Plus, Search, X, Phone, Mail, Building } from "lucide-react";
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
import type { Supplier } from "@shared/schema";
import { useState, useMemo } from "react";

interface SupplierFormData {
    name: string;
    code: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    paymentTerms: string;
    taxId: string;
    notes: string;
}

const emptyForm: SupplierFormData = {
    name: "",
    code: "",
    contactPerson: "",
    email: "",
    phone: "",
    address: "",
    paymentTerms: "",
    taxId: "",
    notes: "",
};

function SupplierFormDialog({
    supplier,
    trigger,
    onSave,
}: {
    supplier?: Supplier;
    trigger: React.ReactNode;
    onSave: (data: SupplierFormData) => Promise<void>;
}) {
    const [open, setOpen] = useState(false);
    const [form, setForm] = useState<SupplierFormData>(
        supplier
            ? {
                name: supplier.name,
                code: supplier.code || "",
                contactPerson: supplier.contactPerson || "",
                email: supplier.email || "",
                phone: supplier.phone || "",
                address: supplier.address || "",
                paymentTerms: supplier.paymentTerms || "",
                taxId: supplier.taxId || "",
                notes: supplier.notes || "",
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
            if (!supplier) setForm(emptyForm);
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>{supplier ? "Edit Supplier" : "Add New Supplier"}</DialogTitle>
                    <DialogDescription>
                        {supplier ? "Update supplier information" : "Enter the details for the new supplier"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Company Name *</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    required
                                    placeholder="Acme Electronics Inc."
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="code">Supplier Code</Label>
                                <Input
                                    id="code"
                                    value={form.code}
                                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                                    placeholder="SUP-001"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="contactPerson">Contact Person</Label>
                                <Input
                                    id="contactPerson"
                                    value={form.contactPerson}
                                    onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                                    placeholder="John Smith"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone">Phone</Label>
                                <Input
                                    id="phone"
                                    value={form.phone}
                                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                    placeholder="+1 555-0123"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={form.email}
                                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                                    placeholder="contact@supplier.com"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="taxId">Tax ID</Label>
                                <Input
                                    id="taxId"
                                    value={form.taxId}
                                    onChange={(e) => setForm({ ...form, taxId: e.target.value })}
                                    placeholder="123-45-6789"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                value={form.address}
                                onChange={(e) => setForm({ ...form, address: e.target.value })}
                                placeholder="123 Business Street, City, Country"
                                rows={2}
                            />
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
                                placeholder="Additional information about this supplier..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={saving || !form.name}>
                            {saving ? "Saving..." : supplier ? "Update" : "Create"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

export function SupplierManagement() {
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");

    const { data, isLoading } = useQuery<Supplier[]>({
        queryKey: ["/api/suppliers"],
    });
    const allSuppliers = data || [];

    const suppliers = useMemo(() => {
        if (!allSuppliers || !searchTerm) return allSuppliers;
        const searchLower = searchTerm.toLowerCase();
        return allSuppliers.filter(
            (s) =>
                s.name.toLowerCase().includes(searchLower) ||
                (s.code && s.code.toLowerCase().includes(searchLower)) ||
                (s.contactPerson && s.contactPerson.toLowerCase().includes(searchLower)) ||
                (s.email && s.email.toLowerCase().includes(searchLower))
        );
    }, [allSuppliers, searchTerm]);

    const createMutation = useMutation({
        mutationFn: async (data: SupplierFormData) => {
            const response = await apiRequest("POST", "/api/suppliers", data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
            toast({ title: "Success", description: "Supplier created successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: SupplierFormData }) => {
            const response = await apiRequest("PUT", `/api/suppliers/${id}`, data);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
            toast({ title: "Success", description: "Supplier updated successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const response = await apiRequest("DELETE", `/api/suppliers/${id}`);
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
            toast({ title: "Success", description: "Supplier deleted successfully" });
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
                        <Truck className="h-5 w-5" />
                        <span>Supplier Management</span>
                    </div>
                    <SupplierFormDialog
                        trigger={
                            <Button size="sm">
                                <Plus className="h-4 w-4 mr-2" />
                                Add Supplier
                            </Button>
                        }
                        onSave={async (data) => {
                            await createMutation.mutateAsync(data);
                        }}
                    />
                </CardTitle>

                <div className="mt-4">
                    <Label htmlFor="supplier-search">Search Suppliers</Label>
                    <div className="relative mt-2">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                        <Input
                            id="supplier-search"
                            placeholder="Search by name, code, contact..."
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
                    {searchTerm && allSuppliers && (
                        <div className="mt-2">
                            <Badge variant="outline" className="bg-blue-50">
                                Showing {suppliers?.length || 0} of {allSuppliers.length} suppliers
                            </Badge>
                        </div>
                    )}
                </div>
            </CardHeader>
            <CardContent>
                {suppliers.length === 0 ? (
                    <div className="text-center py-8">
                        <Truck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">No suppliers found</p>
                        <SupplierFormDialog
                            trigger={
                                <Button>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Add First Supplier
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
                                <TableHead>Supplier</TableHead>
                                <TableHead>Contact</TableHead>
                                <TableHead>Payment Terms</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {suppliers.map((supplier) => (
                                <TableRow key={supplier.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-3">
                                            <div className="bg-orange-100 p-2 rounded-lg">
                                                <Building className="h-4 w-4 text-orange-600" />
                                            </div>
                                            <div>
                                                <div className="font-medium">{supplier.name}</div>
                                                {supplier.code && (
                                                    <div className="text-sm text-gray-500">{supplier.code}</div>
                                                )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="space-y-1">
                                            {supplier.contactPerson && (
                                                <div className="text-sm">{supplier.contactPerson}</div>
                                            )}
                                            {supplier.phone && (
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Phone className="h-3 w-3" />
                                                    {supplier.phone}
                                                </div>
                                            )}
                                            {supplier.email && (
                                                <div className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail className="h-3 w-3" />
                                                    {supplier.email}
                                                </div>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {supplier.paymentTerms || <span className="text-gray-400">-</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge className={supplier.isActive ? "bg-green-600" : "bg-gray-400"}>
                                            {supplier.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end space-x-2">
                                            <SupplierFormDialog
                                                supplier={supplier}
                                                trigger={
                                                    <Button variant="ghost" size="sm">
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                }
                                                onSave={async (data) => {
                                                    await updateMutation.mutateAsync({ id: supplier.id, data });
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
                                                        <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            Are you sure you want to delete "{supplier.name}"? This supplier will be deactivated.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={() => deleteMutation.mutate(supplier.id)}
                                                            className="bg-red-600 hover:bg-red-700"
                                                        >
                                                            Delete
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
