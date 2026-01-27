import React, { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, Barcode as BarcodeIcon } from "lucide-react";
// @ts-ignore - react-barcode may not have types installed
import Barcode from "react-barcode";
import type { Product } from "@shared/schema";

interface BarcodePrintDialogProps {
    product: Product;
    children?: React.ReactNode;
}

export function BarcodePrintDialog({ product, children }: BarcodePrintDialogProps) {
    const [quantity, setQuantity] = useState(1);
    const [open, setOpen] = useState(false);

    const barcodeValue = product.barcode || "000000";

    const handlePrint = () => {
        const printWindow = window.open("", "_blank");
        if (!printWindow) return;

        const barcodeItems = Array.from({ length: quantity })
            .map(
                () => `
      <div class="barcode-item">
        <div class="product-name">${product.name}</div>
        <div class="barcode-container">
          <svg id="barcode-${barcodeValue}"></svg>
        </div>
        <div class="price">$${parseFloat(product.price).toFixed(2)}</div>
      </div>
    `
            )
            .join("");

        printWindow.document.write(`
      <html>
        <head>
          <title>Print Barcodes - ${product.name}</title>
          <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.0/dist/JsBarcode.all.min.js"></script>
          <style>
            @page {
              size: auto;
              margin: 0;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 10px; 
            }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(1.5in, 1fr));
              gap: 15px;
            }
            .barcode-item {
              width: 2in;
              height: 1in;
              border: 1px dashed #ccc;
              padding: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-inside: avoid;
            }
            .product-name {
              font-size: 10px;
              font-weight: bold;
              margin-bottom: 2px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
            }
            .barcode-container svg {
              width: 100%;
              height: auto;
            }
            .price {
              font-size: 10px;
              font-weight: bold;
              margin-top: 2px;
            }
            @media print {
              .barcode-item {
                border: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="barcode-grid">
            ${barcodeItems}
          </div>
          <script>
            window.onload = function() {
              const barcodes = document.querySelectorAll('svg[id^="barcode-"]');
              barcodes.forEach(svg => {
                const value = svg.id.replace('barcode-', '');
                JsBarcode(svg, value, {
                  format: "CODE128",
                  width: 1,
                  height: 30,
                  displayValue: true,
                  fontSize: 10
                });
              });
              setTimeout(() => {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

        printWindow.document.close();
        setOpen(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50 rounded-full" title="Print Barcodes">
                        <BarcodeIcon className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Print Barcodes: {product.name}</DialogTitle>
                </DialogHeader>
                <div className="flex flex-col items-center justify-center p-6 space-y-6">
                    <div className="border p-4 rounded bg-white shadow-sm">
                        <Barcode
                            value={barcodeValue}
                            width={1.5}
                            height={50}
                            fontSize={14}
                            margin={10}
                        />
                    </div>

                    <div className="w-full space-y-4">
                        <div className="grid w-full items-center gap-1.5">
                            <Label htmlFor="quantity">Number of copies</Label>
                            <Input
                                type="number"
                                id="quantity"
                                min="1"
                                max="100"
                                value={quantity}
                                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                            />
                        </div>

                        <div className="bg-blue-50 p-3 rounded-md text-xs text-blue-700">
                            <p>This will generate <strong>${quantity}</strong> barcode(s) for <strong>${product.name}</strong>.</p>
                            <p className="mt-1 opacity-80">Labels are formatted for 2x1 inch adhesive stickers but can be printed on any paper.</p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handlePrint} className="bg-blue-600 hover:bg-blue-700">
                        <Printer className="mr-2 h-4 w-4" />
                        Print Now
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
