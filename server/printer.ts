import { spawn } from 'child_process';
import * as fs from 'fs';

// ESC/POS thermal printer implementation
const ESC = '\x1b';
const GS = '\x1d';
const FS = '\x1c';
const ESCPOS = {
    INIT: ESC + '@',           // Initialize printer
    ALIGN_CENTER: ESC + 'a' + '\x01',
    ALIGN_LEFT: ESC + 'a' + '\x00',
    BOLD_ON: ESC + 'E' + '\x01',
    BOLD_OFF: ESC + 'E' + '\x00',
    CUT: GS + 'V' + '\x00',     // Full cut
    PARTIAL_CUT: GS + 'V' + '\x01',  // Partial cut
    FEED_LINES: (n: number) => ESC + 'd' + String.fromCharCode(n),
    // Character encoding commands
    UTF8_MODE: ESC + 't' + '\xff',   // Select UTF-8 mode (code page 255)
    ARABIC_CODEPAGE: ESC + 't' + '\x16',  // Code page 22 = Arabic (Windows-1256)
    CODEPAGE_PC864: ESC + 't' + '\x17',   // Code page 23 = PC864 Arabic
    // Enable multi-byte character mode for Arabic/Chinese
    KANJI_MODE_ON: FS + '&',
    KANJI_MODE_OFF: FS + '.',
};

export class ReceiptPrinter {
    private devicePath = '/dev/usb/lp1';  // USB printer device

    constructor() {
        console.log('Printer initialized for direct USB (ESC/POS Mode)');
    }

    private async write(content: string): Promise<void> {
        console.log('[PRINTER-DEBUG] write() called, content length:', content.length);
        return new Promise((resolve, reject) => {
            // Add ESC/POS initialization, Arabic encoding, and cut commands
            // Use Windows-1256 Arabic code page for proper Arabic text display
            const escposContent = ESCPOS.INIT + ESCPOS.ARABIC_CODEPAGE + content + '\n\n\n' + ESCPOS.PARTIAL_CUT;

            // Try direct USB first, fallback to lp command
            try {
                if (fs.existsSync(this.devicePath)) {
                    console.log('[PRINTER-DEBUG] Writing directly to', this.devicePath);
                    fs.writeFileSync(this.devicePath, escposContent);
                    console.log('Print job sent successfully via direct USB');
                    resolve();
                    return;
                }
            } catch (err: any) {
                console.log('[PRINTER-DEBUG] Direct USB failed, falling back to lp:', err.message);
            }

            // Fallback to lp command with Raw queue
            console.log('[PRINTER-DEBUG] Using lp with Printer-POS-80-Raw');
            const lp = spawn('lp', ['-d', 'Printer-POS-80-Raw', '-o', 'raw']);

            lp.stdin.write(escposContent);
            lp.stdin.end();

            lp.on('error', (err) => {
                console.error('Failed to spawn lp:', err);
                reject(err);
            });

            lp.on('close', (code) => {
                if (code === 0) {
                    console.log('Print job sent successfully via lp (Raw Mode)');
                    resolve();
                } else {
                    console.error(`lp command failed with code ${code}`);
                    reject(new Error(`Print job failed (lp exit code: ${code})`));
                }
            });
        });
    }

    private formatCurrency(amount: number | string | null | undefined): string {
        const num = Number(amount) || 0;
        return `$${num.toFixed(2)}`;
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
        console.log('[PRINTER-DEBUG] printReceipt() called with orderId:', receiptData.orderId);
        const lines: string[] = [];
        const RATE = receiptData.exchangeRate || 89500;
        const timestamp = new Date(receiptData.timestamp);

        // Header
        lines.push('--------------------------------');
        lines.push(`      ${receiptData.storeName || 'Highway Cafe'}`);
        lines.push('--------------------------------');
        if (receiptData.address) lines.push(receiptData.address);
        if (receiptData.phone) lines.push(receiptData.phone);
        lines.push(`Order #: ${receiptData.orderId}`);
        lines.push(`Date: ${timestamp.toLocaleString()}`);
        lines.push('--------------------------------');

        // Items
        lines.push('Item             Qty    Price');
        lines.push('--------------------------------');

        if (Array.isArray(receiptData.items)) {
            receiptData.items.forEach((item: any) => {
                const nameStr = item.name || 'Unknown';
                const qty = item.quantity || 0;
                const totalUsd = item.total || 0;
                const unitUsd = qty > 0 ? totalUsd / qty : 0;

                const totalLbp = this.convertToLbp(totalUsd, RATE);

                lines.push(`${nameStr}`);
                lines.push(`${qty} x $${unitUsd.toFixed(2)}    $${totalUsd.toFixed(2)}`);
                lines.push(`(${totalLbp} LBP)`);
                lines.push('');
            });
        }

        lines.push('--------------------------------');

        // Totals
        const subtotal = this.formatCurrency(receiptData.subtotal || 0);
        lines.push(`Subtotal: ${subtotal}`);
        if (receiptData.tax) {
            lines.push(`Tax: ${this.formatCurrency(receiptData.tax || 0)}`);
        }
        lines.push(`TOTAL: ${this.formatCurrency(receiptData.total)}`);
        lines.push('--------------------------------');

        const payMethod = (receiptData.paymentMethod || 'CASH').toUpperCase();
        lines.push(`Payment: ${payMethod}`);

        if (receiptData.cashReceived) {
            lines.push(`Cash: ${this.formatCurrency(receiptData.cashReceived)}`);
            lines.push(`Change: ${this.formatCurrency(receiptData.change || 0)}`);
        }

        lines.push('--------------------------------');
        // Footer
        if (receiptData.footerText) {
            lines.push(receiptData.footerText);
        } else {
            lines.push('Thank you for your business!');
        }

        // Feed logic manually added by newlines
        lines.push('\n\n\n\n\n');
        // Some drivers might need a cut command, but in text mode we usually just feed.
        // If the printer supports partial cut on FF, it might work, otherwise we rely on user tearing.

        const fullText = lines.join('\n');
        await this.write(fullText);
    }

    async testPrint(): Promise<void> {
        const lines: string[] = [];
        lines.push('--------------------------------');
        lines.push('      TEST PRINT');
        lines.push('--------------------------------');
        lines.push('Printer is working correctly!');
        lines.push(`Date: ${new Date().toLocaleString()}`);
        lines.push('\n\n\n\n\n');

        await this.write(lines.join('\n'));
    }
}

// Singleton instance
export const receiptPrinter = new ReceiptPrinter();
