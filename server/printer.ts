import { spawn } from 'child_process';
import * as fs from 'fs';
import { createCanvas, registerFont, Canvas } from 'canvas';
// @ts-ignore
import ArabicReshaper from 'arabic-persian-reshaper';

// Register Arabic fonts
try {
    const fontPathRegular = '/usr/share/fonts/truetype/noto/NotoSansArabic-Regular.ttf';
    const fontPathBold = '/usr/share/fonts/truetype/noto/NotoSansArabic-Bold.ttf';
    if (fs.existsSync(fontPathRegular)) {
        registerFont(fontPathRegular, { family: 'ArabicFont', weight: 'normal' });
    }
    if (fs.existsSync(fontPathBold)) {
        registerFont(fontPathBold, { family: 'ArabicFont', weight: 'bold' });
    }
} catch (e) {
    console.warn('Failed to register Arabic fonts, using system default', e);
}

// ESC/POS thermal printer implementation
const ESC = '\x1b';
const GS = '\x1d';
const ESCPOS = {
    INIT: ESC + '@',
    CUT: GS + 'V' + '\x00',
    PARTIAL_CUT: GS + 'V' + '\x01',
};

export class ReceiptPrinter {
    private devicePath = '/dev/usb/lp1';
    private width = 576; // 80mm paper width in pixels (standard is 576 dots)
    private lineHeight = 30;
    private padding = 10;

    constructor() {
        console.log('Printer initialized using Bitmap/Canvas mode for Arabic support');
    }

    private reshapeArabic(text: string): string {
        try {
            // Reshape Arabic characters (fix ligatures)
            const reshaped = ArabicReshaper.convert(text);
            // Check if string contains Arabic
            const hasArabic = /[\u0600-\u06FF]/.test(reshaped);
            if (hasArabic) {
                // Reverse for RTL rendering (since we draw manually)
                return reshaped.split('').reverse().join('');
            }
            return reshaped;
        } catch (e) {
            return text;
        }
    }

    private convertToRaster(canvas: Canvas): Buffer {
        const context = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        const imageData = context.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Calculate width in bytes (rounded up to nearest byte)
        const bytesPerLine = Math.ceil(width / 8);
        const buffer = Buffer.alloc(bytesPerLine * height);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const offset = (y * width + x) * 4;
                const r = data[offset];
                const g = data[offset + 1];
                const b = data[offset + 2];
                const a = data[offset + 3];

                // Simple threshold for monochrome (white background, black text)
                // Pixel is black if brightness < 128 and not transparent
                // Logic: 0 = white, 1 = black for GS v 0 command
                const brightness = (r + g + b) / 3;
                const isBlack = a > 128 && brightness < 128;

                if (isBlack) {
                    const byteIndex = y * bytesPerLine + Math.floor(x / 8);
                    const bitIndex = 7 - (x % 8);
                    buffer[byteIndex] |= (1 << bitIndex);
                }
            }
        }

        // GS v 0 m xL xH yL yH d1...dk
        const header = Buffer.from([
            0x1d, 0x76, 0x30, 0x00,
            bytesPerLine & 0xff, (bytesPerLine >> 8) & 0xff,
            height & 0xff, (height >> 8) & 0xff
        ]);

        return Buffer.concat([header, buffer]);
    }

    private formatCurrency(amount: number | string | null | undefined): string {
        const num = Number(amount) || 0;
        return `$${num.toFixed(2)}`;
    }

    private convertToLbp(usdAmount: number, rate: number = 89500): string {
        const lbp = Math.ceil((usdAmount * rate) / 5000) * 5000;
        return lbp.toLocaleString();
    }

    private drawTextLine(ctx: any, left: string, right: string, y: number, isBold: boolean = false) {
        ctx.font = isBold ? 'bold 22px ArabicFont' : '22px ArabicFont';
        ctx.fillStyle = 'black';
        ctx.textBaseline = 'top';

        // Reshape text
        const safeLeft = this.reshapeArabic(left);
        const safeRight = this.reshapeArabic(right);

        // Draw left text
        ctx.textAlign = 'left';
        ctx.fillText(safeLeft, this.padding, y);

        if (right) {
            ctx.textAlign = 'right';
            ctx.fillText(safeRight, this.width - this.padding, y);
        }
    }

    private drawCentered(ctx: any, text: string, y: number, isBold: boolean = false, fontSize: number = 22) {
        ctx.font = isBold ? `bold ${fontSize}px ArabicFont` : `${fontSize}px ArabicFont`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const safeText = this.reshapeArabic(text);
        ctx.fillText(safeText, this.width / 2, y);
    }

    async printReceipt(receiptData: any): Promise<void> {
        console.log('[PRINTER-DEBUG] Rendering receipt to bitmap image...');

        const RATE = receiptData.exchangeRate || 89500;
        const timestamp = new Date(receiptData.timestamp);

        // Calculate estimated height
        let estimatedHeight = 500; // Increased base height estimate
        // Items * 3 lines (Name, Price, LBP)
        estimatedHeight += (receiptData.items?.length || 0) * (this.lineHeight * 3.5);

        const canvas = createCanvas(this.width, estimatedHeight + 500); // 500 extra buffer
        const ctx = canvas.getContext('2d');

        // White background
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = 'black';

        let y = 20;

        // Header
        this.drawCentered(ctx, receiptData.storeName || 'Receipt', y, true, 30);
        y += 40;

        if (receiptData.address) {
            this.drawCentered(ctx, receiptData.address, y);
            y += this.lineHeight;
        }
        if (receiptData.phone) {
            this.drawCentered(ctx, receiptData.phone, y);
            y += this.lineHeight;
        }

        y += 10;
        this.drawTextLine(ctx, `Order #: ${receiptData.orderId}`, '', y);
        y += this.lineHeight;
        this.drawTextLine(ctx, `Date: ${timestamp.toLocaleString()}`, '', y);
        y += this.lineHeight + 10; // Extra spacing

        // Divider
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(this.width - 10, y);
        ctx.stroke();
        y += 10;

        // Headers
        this.drawTextLine(ctx, 'Item', 'Qty   Price', y, true);
        y += this.lineHeight;

        // Divider
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(this.width - 10, y);
        ctx.stroke();
        y += 10;

        // Items
        if (Array.isArray(receiptData.items)) {
            receiptData.items.forEach((item: any) => {
                const nameStr = item.name || 'Unknown';
                const qty = item.quantity || 0;
                const totalUsd = item.total || 0;
                const unitUsd = qty > 0 ? totalUsd / qty : 0;
                const totalLbp = this.convertToLbp(totalUsd, RATE);

                // Line 1: Item Name
                this.drawTextLine(ctx, nameStr, '', y, true); // Bold item name
                y += this.lineHeight;

                // Line 2: Qty x Unit Price ... Total Price
                const priceDetail = `${qty} x ${unitUsd.toFixed(2)}`;
                const totalDetail = `$${totalUsd.toFixed(2)}`;
                this.drawTextLine(ctx, priceDetail, totalDetail, y);
                y += this.lineHeight;

                // Line 3: LBP Price
                this.drawTextLine(ctx, '', `(${totalLbp} LBP)`, y);
                y += this.lineHeight + 5; // Extra gap item
            });
        }

        // Divider
        ctx.beginPath();
        ctx.moveTo(10, y);
        ctx.lineTo(this.width - 10, y);
        ctx.stroke();
        y += 30; // Increased spacing after item grid (was 10)

        // Totals
        const subtotal = this.formatCurrency(receiptData.subtotal || 0);
        this.drawTextLine(ctx, 'Subtotal:', subtotal, y);
        y += this.lineHeight;

        if (Number(receiptData.discountTotal || receiptData.discount) > 0) {
            const discountAmount = Number(receiptData.discountTotal || receiptData.discount);
            this.drawTextLine(ctx, 'Discount:', `-${this.formatCurrency(discountAmount)}`, y);
            y += this.lineHeight;
        }

        if (receiptData.tax) {
            const tax = this.formatCurrency(receiptData.tax || 0);
            this.drawTextLine(ctx, 'Tax:', tax, y);
            y += this.lineHeight;
        }



        // Dividor before Total
        ctx.beginPath();
        ctx.moveTo(this.padding, y);
        ctx.lineTo(this.width - this.padding, y);
        ctx.stroke();
        y += 10;

        this.drawTextLine(ctx, 'TOTAL:', this.formatCurrency(receiptData.total), y, true);
        y += this.lineHeight + 5;

        // Payment Info
        const payMethod = (receiptData.paymentMethod || 'CASH').toUpperCase();
        this.drawTextLine(ctx, 'Payment:', payMethod, y);
        y += this.lineHeight;

        if (receiptData.cashReceived) {
            this.drawTextLine(ctx, 'Cash:', this.formatCurrency(receiptData.cashReceived), y);
            y += this.lineHeight;
            this.drawTextLine(ctx, 'Change:', this.formatCurrency(receiptData.change || 0), y);
            y += this.lineHeight;
        }

        y += 40; // Add robust spacing before footer

        // Footer
        if (receiptData.footerText) {
            this.drawCentered(ctx, receiptData.footerText, y);
        } else {
            this.drawCentered(ctx, 'Thank you for your business!', y);
        }
        y += this.lineHeight * 8; // Increased padding to ensure footer clears the cutter (approx 200px)

        // Crop canvas to actual used height with some padding
        const finalHeight = y;
        const finalCanvas = createCanvas(this.width, finalHeight);
        const finalCtx = finalCanvas.getContext('2d');
        // Fill white first
        finalCtx.fillStyle = 'white';
        finalCtx.fillRect(0, 0, this.width, finalHeight);
        finalCtx.drawImage(canvas, 0, 0);

        // Convert to Raster
        console.log('[PRINTER-DEBUG] Converting canvas to raster buffer...');
        const rasterData = this.convertToRaster(finalCanvas);

        const initCmd = Buffer.from(ESCPOS.INIT, 'ascii');
        const cutCmd = Buffer.from(ESCPOS.PARTIAL_CUT, 'ascii');
        const finalBuffer = Buffer.concat([initCmd, rasterData, cutCmd]);

        console.log(`[PRINTER-DEBUG] Bitmap generated, size: ${finalBuffer.length} bytes`);
        await this.write(finalBuffer);
    }

    private async write(buffer: Buffer): Promise<void> {
        return new Promise((resolve, reject) => {
            // Try direct USB first
            try {
                if (fs.existsSync(this.devicePath)) {
                    console.log('[PRINTER-DEBUG] Writing direct to USB:', this.devicePath);
                    const fd = fs.openSync(this.devicePath, 'w');
                    fs.writeSync(fd, buffer);
                    fs.closeSync(fd);
                    console.log('Bitmap print sent successfully via direct USB');
                    resolve();
                    return;
                }
            } catch (err: any) {
                console.log('[PRINTER-DEBUG] Direct USB failed:', err.message);
            }

            // Fallback to lp command
            console.log('[PRINTER-DEBUG] Fallback to lp raw');
            // Pipe buffer to lp
            const lp = spawn('lp', ['-d', 'Printer-POS-80-Raw', '-o', 'raw']);

            lp.stdin.on('error', (err) => {
                console.error('LP stdin error:', err);
                reject(err);
            });

            lp.stdin.write(buffer);
            lp.stdin.end();

            lp.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`lp failed with code ${code}`));
            });

            lp.on('error', (err) => {
                console.error('LP error:', err);
                reject(err);
            });
        });
    }

    async testPrint(): Promise<void> {
        // Create dummy order data for test
        const testData = {
            orderId: 'TEST-BITMAP',
            storeName: 'Heavy\'s Grill',
            timestamp: new Date(),
            items: [
                { name: 'شاورما دجاج', quantity: 1, price: 5, total: 5 },
                { name: 'Burger', quantity: 2, price: 8, total: 16 }
            ],
            subtotal: 21,
            total: 21,
            paymentMethod: 'CASH',
            footerText: 'Bitmap Printing Test'
        };
        await this.printReceipt(testData);
    }
}

// Singleton instance
export const receiptPrinter = new ReceiptPrinter();
