import { writeFile } from 'fs/promises';
import { constants, accessSync } from 'fs';
// @ts-ignore
import { ArabicShaper } from 'arabic-persian-reshaper';
import iconv from 'iconv-lite';
import { CP864_MAPPING } from './cp864-map';

// ESC/POS Commands
const CMD = {
    INIT: Buffer.from([0x1B, 0x40]),
    KANJI_OFF: Buffer.from([0x1C, 0x2E]),
    // Code Page 22 (Arabic PC864)
    CODEPAGE_ARABIC: Buffer.from([0x1B, 0x74, 22]),
    ALIGN_CENTER: Buffer.from([0x1B, 0x61, 0x01]),
    ALIGN_LEFT: Buffer.from([0x1B, 0x61, 0x00]),
    ALIGN_RIGHT: Buffer.from([0x1B, 0x61, 0x02]),
    BOLD_ON: Buffer.from([0x1B, 0x45, 0x01]),
    BOLD_OFF: Buffer.from([0x1B, 0x45, 0x00]),
    SIZE_NORMAL: Buffer.from([0x1D, 0x21, 0x00]),
    SIZE_DOUBLE: Buffer.from([0x1D, 0x21, 0x11]),
    CUT: Buffer.from([0x1D, 0x56, 0x41, 0x03]),
    FEED: Buffer.from([0x0A]),
};

export class ReceiptPrinter {
    private devicePath: string;

    constructor() {
        // Try multiple possible device paths
        const possiblePaths = ['/dev/usb/lp1', '/dev/usb/lp0', '/dev/lp1', '/dev/lp0'];
        this.devicePath = '';

        for (const path of possiblePaths) {
            try {
                // Check synchronously if file exists
                accessSync(path, constants.F_OK);
                this.devicePath = path;
                console.log(`Printer device found at: ${this.devicePath}`);
                break;
            } catch (err) {
                console.log(`Failed to access ${path}:`, err);
                // Try next path
            }
        }

        if (!this.devicePath) {
            console.warn('No writable printer device found. Print operations will fail.');
        }
    }

    private async write(buffer: Buffer): Promise<void> {
        if (!this.devicePath) {
            throw new Error('No printer device available');
        }

        try {
            await writeFile(this.devicePath, buffer);
        } catch (error: any) {
            throw new Error(`Failed to write to printer: ${error.message}`);
        }
    }

    private formatCurrency(amount: number | string | null | undefined): string {
        const num = Number(amount) || 0;
        return `$${num.toFixed(2)}`;
    }

    private text(str: string): Buffer {
        if (!str) return Buffer.from('');

        // Check for Arabic characters
        const hasArabic = /[\u0600-\u06FF]/.test(str);

        if (hasArabic) {
            try {
                // Reshape Arabic (connect letters)
                const reshaped = ArabicShaper.convertArabic(str);

                // Reverse for RTL printing
                const reversed = reshaped.split('').reverse().join('');

                // Map to CP864 bytes
                const buffer = Buffer.alloc(reversed.length);
                for (let i = 0; i < reversed.length; i++) {
                    const charCode = reversed.charCodeAt(i);
                    // Check custom mapping first, then standard iconv
                    if (CP864_MAPPING[charCode]) {
                        buffer[i] = CP864_MAPPING[charCode];
                    } else {
                        // Fallback for numbers/English within the Arabic string
                        if (charCode <= 0x7F) {
                            buffer[i] = charCode;
                        } else {
                            // Try iconv as last resort or '?'
                            const encoded = iconv.encode(reversed[i], 'cp864');
                            buffer[i] = encoded.length > 0 ? encoded[0] : 0x3F; // 0x3F is '?'
                        }
                    }
                }
                return buffer;
            } catch (e) {
                console.error('Arabic shaping error:', e);
                return Buffer.from(str, 'utf-8');
            }
        }

        // Standard POS encoding for English
        return iconv.encode(str, 'cp437');
    }
    private convertToLbp(usdAmount: number, rate: number = 89500): string {
        const lbp = Math.ceil((usdAmount * rate) / 5000) * 5000;
        return lbp.toLocaleString();
    }
    async printReceipt(receiptData: {
        storeName: string;
        address?: string;
        phone?: string;
        orderId: string;
        items: Array<{ name: string; quantity: number; price: number; total: number }>;
        subtotal: number;
        tax?: number;
        total: number;
        paymentMethod: string;
        cashReceived?: number;
        change?: number;
        timestamp: Date;
        footerText?: string;
        exchangeRate?: number;
    }): Promise<void> {
        const timestamp = new Date(receiptData.timestamp);
        const buffers: Buffer[] = [];
        const RATE = receiptData.exchangeRate || 89500;

        // Build Payload
        buffers.push(CMD.INIT);
        buffers.push(CMD.KANJI_OFF); // Disable Chinese mode
        buffers.push(CMD.CODEPAGE_ARABIC);

        buffers.push(CMD.ALIGN_CENTER);
        buffers.push(CMD.BOLD_ON);
        buffers.push(CMD.SIZE_DOUBLE);
        buffers.push(this.text(receiptData.storeName || 'Highway Cafe'));
        buffers.push(CMD.FEED);

        buffers.push(CMD.SIZE_NORMAL);
        buffers.push(CMD.BOLD_OFF);

        if (receiptData.address) {
            buffers.push(this.text(receiptData.address));
            buffers.push(CMD.FEED);
        }
        if (receiptData.phone) {
            buffers.push(this.text(receiptData.phone));
            buffers.push(CMD.FEED);
        }

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        buffers.push(CMD.ALIGN_LEFT);
        buffers.push(this.text(`Order #: ${receiptData.orderId}`));
        buffers.push(CMD.FEED);
        buffers.push(this.text(`Date: ${timestamp.toLocaleString()}`));
        buffers.push(CMD.FEED);

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        // Table Header
        buffers.push(this.text('Item                           Qty    Price'));
        buffers.push(CMD.FEED);
        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        if (Array.isArray(receiptData.items)) {
            receiptData.items.forEach((item: any) => {
                const nameStr = item.name || 'Unknown';
                const qty = item.quantity || 0;
                const totalUsd = item.total || 0;

                // Calculate Unit Prices
                const unitUsd = qty > 0 ? totalUsd / qty : 0;

                // Convert to LBP
                const totalLbp = this.convertToLbp(totalUsd, RATE);
                const unitLbp = this.convertToLbp(unitUsd, RATE);

                // Line 1: Item Name (Bold)
                buffers.push(CMD.BOLD_ON);
                buffers.push(this.text(nameStr));
                buffers.push(CMD.BOLD_OFF);
                buffers.push(CMD.FEED);

                // Line 2: Details
                // Format: " 2 @ $5.00/450,000      $10.00/900,000"
                const UNIT_STR = `$${unitUsd.toFixed(2)}/${unitLbp}`;
                const TOTAL_STR = `$${totalUsd.toFixed(2)}/${totalLbp}`;

                const leftPart = ` ${qty} @ ${UNIT_STR}`;
                const rightPart = TOTAL_STR;

                // Width 48
                const padding = 48 - leftPart.length - rightPart.length;
                const spaces = padding > 0 ? ' '.repeat(padding) : ' ';

                buffers.push(this.text(leftPart + spaces + rightPart));
                buffers.push(CMD.FEED);
                buffers.push(CMD.FEED); // Extra spacing
            });
        }

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        // Totals
        buffers.push(CMD.ALIGN_RIGHT);

        const subtotal = this.formatCurrency(receiptData.subtotal || 0);
        buffers.push(this.text(`Subtotal: ${subtotal}`));
        buffers.push(CMD.FEED);

        if (receiptData.tax) {
            buffers.push(this.text(`Tax: ${this.formatCurrency(receiptData.tax || 0)}`));
            buffers.push(CMD.FEED);
        }

        buffers.push(CMD.BOLD_ON);
        buffers.push(CMD.SIZE_DOUBLE);
        buffers.push(this.text(`TOTAL: ${this.formatCurrency(receiptData.total)}`));
        buffers.push(CMD.FEED);
        buffers.push(CMD.SIZE_NORMAL);
        buffers.push(CMD.BOLD_OFF);

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        const payMethod = (receiptData.paymentMethod || 'CASH').toUpperCase();
        buffers.push(this.text(`Payment: ${payMethod}`));
        buffers.push(CMD.FEED);

        if (receiptData.cashReceived) {
            buffers.push(this.text(`Cash: ${this.formatCurrency(receiptData.cashReceived)}`));
            buffers.push(CMD.FEED);
            buffers.push(this.text(`Change: ${this.formatCurrency(receiptData.change || 0)}`));
            buffers.push(CMD.FEED);
        }

        // Footer
        buffers.push(CMD.ALIGN_CENTER);
        buffers.push(CMD.FEED);
        if (receiptData.footerText) {
            buffers.push(this.text(receiptData.footerText));
            buffers.push(CMD.FEED);
        } else {
            buffers.push(this.text('Thank you for your business!'));
            buffers.push(CMD.FEED);
        }

        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.CUT);

        const fullPayload = Buffer.concat(buffers);
        await this.write(fullPayload);
    }

    async testPrint(): Promise<void> {
        let buffers: Buffer[] = [];
        buffers.push(CMD.INIT);
        buffers.push(CMD.ALIGN_CENTER);
        buffers.push(CMD.BOLD_ON);
        buffers.push(CMD.SIZE_DOUBLE);
        buffers.push(this.text('TEST PRINT'));
        buffers.push(CMD.FEED);
        buffers.push(CMD.SIZE_NORMAL);
        buffers.push(CMD.BOLD_OFF);
        buffers.push(this.text('Printer is working correctly!'));
        buffers.push(CMD.FEED);
        buffers.push(this.text(`Date: ${new Date().toLocaleString()}`));
        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.CUT);

        await this.write(Buffer.concat(buffers));
    }
}

// Singleton instance
export const receiptPrinter = new ReceiptPrinter();
