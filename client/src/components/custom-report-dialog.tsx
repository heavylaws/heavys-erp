import { useQuery } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Loader2, DollarSign, CreditCard, ShoppingCart, Calendar } from "lucide-react";

interface CustomReportDialogProps {
    dateRange: { start: string; end: string } | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function CustomReportDialog({ dateRange, open, onOpenChange }: CustomReportDialogProps) {
    const { data: report, isLoading, error } = useQuery({
        queryKey: ['/api/reports/custom', dateRange?.start, dateRange?.end],
        queryFn: async () => {
            if (!dateRange) return null;
            const params = new URLSearchParams({
                start: dateRange.start,
                end: dateRange.end
            });
            const res = await fetch(`/api/reports/custom?${params}`);
            if (!res.ok) throw new Error("Failed to fetch report");
            return res.json();
        },
        enabled: !!dateRange && open,
    });

    if (!dateRange) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Custom Performance Report
                    </DialogTitle>
                    <DialogDescription>
                        Audit for period: {new Date(dateRange.start).toLocaleString()} - {new Date(dateRange.end).toLocaleString()}
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : error ? (
                    <div className="text-red-500">Failed to load report.</div>
                ) : report ? (
                    <div className="space-y-6">
                        {/* Header Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Total Sales
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{formatCurrency(report.summary.totalSales)}</div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                        {report.summary.totalOrders} Orders
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Cash Collected
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        <DollarSign className="h-4 w-4 text-green-600" />
                                        <div className="text-2xl font-bold">{formatCurrency(report.summary.cashCollected)}</div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-medium text-muted-foreground">
                                        Card / Digital
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center gap-2">
                                        <CreditCard className="h-4 w-4 text-blue-600" />
                                        <div className="text-2xl font-bold">{formatCurrency(report.summary.cardCollected)}</div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Product Breakdown */}
                        <div className="space-y-2">
                            <h3 className="text-lg font-semibold flex items-center gap-2">
                                <ShoppingCart className="h-5 w-5" />
                                Product Breakdown
                            </h3>
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Product</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead className="text-right">Qty</TableHead>
                                            <TableHead className="text-right">Revenue</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {report.productBreakdown.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                                                    No products sold during this period.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            report.productBreakdown.map((item: any) => (
                                                <TableRow key={item.productId}>
                                                    <TableCell className="font-medium">{item.productName}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{item.category || 'Uncategorized'}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">{item.quantity}</TableCell>
                                                    <TableCell className="text-right font-medium">
                                                        {formatCurrency(item.revenue)}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
