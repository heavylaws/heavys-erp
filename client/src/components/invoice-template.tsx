import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Printer, Download, X } from "lucide-react";
import { useExchangeRate } from "@/hooks/useExchangeRate";

interface InvoiceItem {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    sku?: string;
}

interface InvoiceData {
    invoiceNumber: string;
    date: Date;
    customer?: {
        name: string;
        address?: string;
        phone?: string;
        email?: string;
        taxId?: string;
    };
    items: InvoiceItem[];
    subtotal: number;
    tax: number;
    taxRate: number;
    total: number;
    paymentMethod: string;
    notes?: string;
}

interface CompanyInfo {
    name: string;
    address: string;
    phone: string;
    email?: string;
    taxId?: string;
    logo?: string;
}

interface InvoiceTemplateProps {
    invoice: InvoiceData;
    company: CompanyInfo;
    onClose?: () => void;
    showActions?: boolean;
}

export function InvoiceTemplate({ invoice, company, onClose, showActions = true }: InvoiceTemplateProps) {
    const printRef = useRef<HTMLDivElement>(null);
    const { rate, secondaryCurrency, primaryCurrency } = useExchangeRate();

    const formatPrimary = (amount: number) => `${primaryCurrency} ${amount.toFixed(2)}`;
    const formatSecondary = (amount: number) => `${secondaryCurrency} ${(amount * rate).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

    const handlePrint = () => {
        const printContent = printRef.current;
        if (!printContent) return;

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; font-size: 12px; color: #333; }
            .invoice { max-width: 210mm; margin: 0 auto; padding: 20mm; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; color: #1a1a1a; }
            .company-details { font-size: 11px; color: #666; margin-top: 5px; }
            .invoice-meta { text-align: right; }
            .invoice-number { font-size: 18px; font-weight: bold; }
            .invoice-date { color: #666; margin-top: 5px; }
            .parties { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .party { width: 45%; }
            .party-label { font-size: 10px; color: #999; text-transform: uppercase; margin-bottom: 5px; }
            .party-name { font-size: 14px; font-weight: bold; }
            .party-details { font-size: 11px; color: #666; line-height: 1.5; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f5f5f5; padding: 10px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; border-bottom: 2px solid #ddd; }
            td { padding: 10px; border-bottom: 1px solid #eee; }
            .text-right { text-align: right; }
            .totals { width: 300px; margin-left: auto; }
            .totals tr td { padding: 8px 10px; }
            .totals .label { color: #666; }
            .totals .total-row { font-size: 16px; font-weight: bold; background: #f5f5f5; }
            .totals .secondary { color: #666; font-size: 12px; font-weight: normal; }
            .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }
            .payment-info { font-size: 11px; color: #666; }
            .notes { margin-top: 20px; padding: 15px; background: #f9f9f9; border-radius: 4px; font-size: 11px; }
            .thank-you { text-align: center; margin-top: 40px; font-size: 14px; color: #666; }
            @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
        printWindow.document.close();
        printWindow.print();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-auto">
            <Card className="w-full max-w-[210mm] bg-white shadow-2xl max-h-[90vh] overflow-auto">
                {showActions && (
                    <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center z-10">
                        <h2 className="font-bold text-lg">Invoice Preview</h2>
                        <div className="flex gap-2">
                            <Button onClick={handlePrint} variant="outline">
                                <Printer className="h-4 w-4 mr-2" />
                                Print
                            </Button>
                            {onClose && (
                                <Button onClick={onClose} variant="ghost">
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </div>
                )}

                <CardContent className="p-8" ref={printRef}>
                    <div className="invoice">
                        {/* Header */}
                        <div className="header flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-8">
                            <div>
                                <div className="company-name text-2xl font-bold">{company.name}</div>
                                <div className="company-details text-sm text-gray-600 mt-2 space-y-1">
                                    <div>{company.address}</div>
                                    <div>{company.phone}</div>
                                    {company.email && <div>{company.email}</div>}
                                    {company.taxId && <div>Tax ID: {company.taxId}</div>}
                                </div>
                            </div>
                            <div className="invoice-meta text-right">
                                <div className="invoice-number text-xl font-bold">INVOICE</div>
                                <div className="text-lg font-mono mt-1">{invoice.invoiceNumber}</div>
                                <div className="invoice-date text-gray-600 mt-2">
                                    {invoice.date.toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Customer Info */}
                        {invoice.customer && (
                            <div className="parties mb-8">
                                <div className="party">
                                    <div className="party-label text-xs text-gray-500 uppercase mb-2">Bill To</div>
                                    <div className="party-name text-lg font-bold">{invoice.customer.name}</div>
                                    <div className="party-details text-sm text-gray-600 mt-2 space-y-1">
                                        {invoice.customer.address && <div>{invoice.customer.address}</div>}
                                        {invoice.customer.phone && <div>{invoice.customer.phone}</div>}
                                        {invoice.customer.email && <div>{invoice.customer.email}</div>}
                                        {invoice.customer.taxId && <div>Tax ID: {invoice.customer.taxId}</div>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Items Table */}
                        <table className="w-full mb-8">
                            <thead>
                                <tr className="bg-gray-100">
                                    <th className="text-left p-3 text-xs uppercase text-gray-600">#</th>
                                    <th className="text-left p-3 text-xs uppercase text-gray-600">Description</th>
                                    <th className="text-right p-3 text-xs uppercase text-gray-600">Qty</th>
                                    <th className="text-right p-3 text-xs uppercase text-gray-600">Unit Price</th>
                                    <th className="text-right p-3 text-xs uppercase text-gray-600">Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {invoice.items.map((item, index) => (
                                    <tr key={index} className="border-b border-gray-200">
                                        <td className="p-3 text-gray-600">{index + 1}</td>
                                        <td className="p-3">
                                            <div className="font-medium">{item.name}</div>
                                            {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                                        </td>
                                        <td className="p-3 text-right">{item.quantity}</td>
                                        <td className="p-3 text-right">{formatPrimary(item.unitPrice)}</td>
                                        <td className="p-3 text-right font-medium">{formatPrimary(item.total)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Totals */}
                        <div className="flex justify-end">
                            <table className="w-80">
                                <tbody>
                                    <tr>
                                        <td className="p-2 text-gray-600">Subtotal</td>
                                        <td className="p-2 text-right">{formatPrimary(invoice.subtotal)}</td>
                                    </tr>
                                    <tr>
                                        <td className="p-2 text-gray-600">Tax ({invoice.taxRate}%)</td>
                                        <td className="p-2 text-right">{formatPrimary(invoice.tax)}</td>
                                    </tr>
                                    <tr className="bg-gray-100 font-bold">
                                        <td className="p-3">Total</td>
                                        <td className="p-3 text-right">
                                            <div className="text-lg">{formatPrimary(invoice.total)}</div>
                                            <div className="text-gray-600 font-normal text-sm">{formatSecondary(invoice.total)}</div>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* Footer */}
                        <div className="footer mt-10 pt-6 border-t border-gray-300">
                            <div className="payment-info text-sm text-gray-600">
                                <span className="font-medium">Payment Method:</span> {invoice.paymentMethod}
                            </div>

                            {invoice.notes && (
                                <div className="notes mt-4 p-4 bg-gray-50 rounded text-sm">
                                    <span className="font-medium">Notes:</span> {invoice.notes}
                                </div>
                            )}

                            <div className="thank-you text-center mt-10 text-gray-500">
                                Thank you for your business!
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

// Hook to generate invoice from order
export function useInvoiceGenerator() {
    const generateInvoiceNumber = () => {
        const date = new Date();
        const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `INV-${dateStr}-${random}`;
    };

    const createInvoiceFromOrder = (order: any, customer?: any): InvoiceData => {
        const items: InvoiceItem[] = order.items.map((item: any) => ({
            name: item.product?.name || item.name || 'Product',
            quantity: item.quantity,
            unitPrice: Number(item.price),
            total: Number(item.price) * item.quantity,
            sku: item.product?.sku,
        }));

        const subtotal = items.reduce((sum, item) => sum + item.total, 0);
        const taxRate = 10; // Default 10% - can be configurable
        const tax = subtotal * (taxRate / 100);
        const total = subtotal + tax;

        return {
            invoiceNumber: generateInvoiceNumber(),
            date: new Date(),
            customer: customer ? {
                name: customer.name,
                address: customer.address,
                phone: customer.phone,
                email: customer.email,
                taxId: customer.taxId,
            } : undefined,
            items,
            subtotal,
            tax,
            taxRate,
            total,
            paymentMethod: order.paymentMethod || 'Cash',
            notes: order.notes,
        };
    };

    return { generateInvoiceNumber, createInvoiceFromOrder };
}
