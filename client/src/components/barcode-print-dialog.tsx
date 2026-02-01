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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Printer, Barcode as BarcodeIcon } from "lucide-react";
// @ts-ignore - react-barcode may not have types installed
import Barcode from "react-barcode";
import type { Product } from "@shared/schema";

interface BarcodePrintDialogProps {
  product: Product;
  children?: React.ReactNode;
}

type DimensionType = "40x30" | "58x30";

const DIMENSIONS = {
  "40x30": {
    width: "40mm",
    height: "30mm",
    label: "40mm x 30mm (4cm x 3cm)",
    name: "Small (40x30mm)"
  },
  "58x30": {
    width: "58mm",
    height: "30mm",
    label: "58mm x 30mm",
    name: "Large (58x30mm)"
  }
};

export function BarcodePrintDialog({ product, children }: BarcodePrintDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const [open, setOpen] = useState(false);
  const [dimension, setDimension] = useState<DimensionType>("40x30");

  const barcodeValue = product.barcode || "000000";

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const selectedDim = DIMENSIONS[dimension];

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
              margin: 0mm;
            }
            body { 
              font-family: Arial, sans-serif; 
              margin: 0; 
              padding: 0;
              width: ${selectedDim.width};
              height: ${selectedDim.height};
              overflow: hidden;
            }
            .barcode-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(${selectedDim.width}, 1fr));
              gap: 5px;
            }
            .barcode-item {
              width: ${selectedDim.width};
              height: ${selectedDim.height};
              border: 1px dashed #ccc;
              padding: 2px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              text-align: center;
              page-break-inside: avoid;
              box-sizing: border-box;
              overflow: hidden;
            }
            .product-name {
              font-size: 8px;
              font-weight: bold;
              margin-bottom: 1px;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              width: 100%;
              line-height: 1.1;
            }
            .barcode-container {
              flex: 1;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100%;
              overflow: hidden;
            }
            .barcode-container svg {
              width: 100%;
              max-height: 100%;
            }
            .price {
              font-size: 9px;
              font-weight: bold;
              margin-top: 1px;
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
              const isLarge = "${dimension}" === "58x30";
              
              barcodes.forEach(svg => {
                const value = svg.id.replace('barcode-', '');
                JsBarcode(svg, value, {
                  format: "CODE128",
                  width: isLarge ? 2 : 1.3,
                  height: isLarge ? 50 : 35,
                  displayValue: true,
                  fontSize: isLarge ? 12 : 9,
                  margin: 0
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
          <div className="border p-4 rounded bg-white shadow-sm" style={{
            width: dimension === "40x30" ? "200px" : "290px",
            height: "150px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Barcode
              value={barcodeValue}
              width={dimension === "40x30" ? 1.2 : 1.5}
              height={40}
              fontSize={12}
              margin={5}
            />
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <Label>Label Size</Label>
              <RadioGroup value={dimension} onValueChange={(v) => setDimension(v as DimensionType)} className="grid grid-cols-2 gap-4">
                <div>
                  <RadioGroupItem value="40x30" id="d40x30" className="peer sr-only" />
                  <Label
                    htmlFor="d40x30"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="mb-2 text-sm font-semibold">{DIMENSIONS["40x30"].name}</span>
                    <span className="text-xs text-muted-foreground">{DIMENSIONS["40x30"].label}</span>
                  </Label>
                </div>
                <div>
                  <RadioGroupItem value="58x30" id="d58x30" className="peer sr-only" />
                  <Label
                    htmlFor="d58x30"
                    className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary"
                  >
                    <span className="mb-2 text-sm font-semibold">{DIMENSIONS["58x30"].name}</span>
                    <span className="text-xs text-muted-foreground">{DIMENSIONS["58x30"].label}</span>
                  </Label>
                </div>
              </RadioGroup>
            </div>

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
              <p>Generating <strong>{quantity}</strong> barcode(s) Size: <strong>{DIMENSIONS[dimension].label}</strong></p>
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
