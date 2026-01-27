import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { writeFile } from 'fs/promises';
import { constants, accessSync } from 'fs';

// --- Printer Logic (Adapted from printer-agent.ts) ---

// ESC/POS Commands as Buffers
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

// @ts-ignore
import { CP864_MAPPING } from './cp864-map';
// @ts-ignore
import { ArabicShaper } from 'arabic-persian-reshaper';
import iconv from 'iconv-lite';

class ElectronReceiptPrinter {
    private devicePath: string;

    constructor() {
        const possiblePaths = ['/dev/usb/lp1', '/dev/usb/lp0', '/dev/lp1', '/dev/lp0'];
        this.devicePath = '';

        for (const p of possiblePaths) {
            try {
                accessSync(p, constants.F_OK);
                this.devicePath = p;
                console.log(`[Electron Printer] Device found at: ${this.devicePath}`);
                break;
            } catch (err) { }
        }

        if (!this.devicePath) {
            console.warn('[Electron Printer] No writable printer device: Printing DISABLED');
        }
    }

    private formatCurrency(amount: number | string | null | undefined): string {
        const num = Number(amount) || 0;
        // Use currency formatting options if needed, but keeping simple for now
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
                        // 0x30-0x39 are digits, 0x20 space, etc.
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

        // Non-Arabic (English/Numbers) -> Encode usually as CP437 or just standard ASCII (which is subset of CP864)
        // Note: CP864 also contains ASCII so we can just use cp864 for everything OR use ascii/utf8 for mixed.
        // However, standard thermal printers expecting CP864 might map extended chars differently.
        // Safe bet: standard text is usually ASCII.
        // Let's use iconv to enforce single byte encoding compatible with the printer
        return iconv.encode(str, 'cp437'); // Standard POS encoding for English
    }

    async write(buffer: Buffer): Promise<void> {
        if (!this.devicePath) throw new Error('No printer device available');
        await writeFile(this.devicePath, buffer);
    }

    private convertToLbp(usdAmount: number, rate: number = 89500): string {
        const lbp = Math.ceil((usdAmount * rate) / 5000) * 5000;
        return lbp.toLocaleString();
    }

    async printReceipt(receiptData: any): Promise<void> {
        const timestamp = new Date(receiptData.timestamp || Date.now());
        const buffers: Buffer[] = [];
        const RATE = receiptData.exchangeRate || 89500;

        // Build Payload
        buffers.push(CMD.INIT);
        buffers.push(CMD.KANJI_OFF);
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

        // Header
        // "Item" on left, "Price" on right
        buffers.push(CMD.BOLD_ON);
        buffers.push(this.text('Item Details'));
        buffers.push(CMD.BOLD_OFF);
        buffers.push(CMD.FEED);
        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        if (Array.isArray(receiptData.items)) {
            receiptData.items.forEach((item: any) => {
                const nameStr = item.name || 'Unknown';
                const qty = item.quantity || 0;
                const totalUsd = item.total || 0;
                const totalLbp = this.convertToLbp(totalUsd, RATE);

                const unitUsd = qty > 0 ? totalUsd / qty : 0;
                const unitLbp = this.convertToLbp(unitUsd, RATE);

                // Line 1: Item Name - Bold
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
                buffers.push(CMD.FEED); // Spacer 
            });
        }

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);

        // Totals
        buffers.push(CMD.ALIGN_RIGHT);

        const subtotalUsd = receiptData.subtotal || 0;
        const subtotalLbp = this.convertToLbp(subtotalUsd, RATE);

        buffers.push(this.text(`Subtotal: $${subtotalUsd.toFixed(2)}`));
        buffers.push(CMD.FEED);
        buffers.push(this.text(`${subtotalLbp} LBP`));
        buffers.push(CMD.FEED);

        if (receiptData.tax) {
            buffers.push(this.text(`Tax: $${Number(receiptData.tax).toFixed(2)}`));
            buffers.push(CMD.FEED);
        }

        buffers.push(CMD.FEED);
        buffers.push(CMD.BOLD_ON);
        buffers.push(CMD.SIZE_DOUBLE);

        const totalUsd = receiptData.total || 0;
        const totalLbp = this.convertToLbp(totalUsd, RATE);

        buffers.push(this.text(`TOTAL: $${totalUsd.toFixed(2)}`));
        buffers.push(CMD.FEED);
        buffers.push(this.text(`${totalLbp} LBP`));

        buffers.push(CMD.SIZE_NORMAL);
        buffers.push(CMD.BOLD_OFF);
        buffers.push(CMD.FEED);

        buffers.push(this.text('------------------------------------------------'));
        buffers.push(CMD.FEED);


        const payMethod = (receiptData.paymentMethod || 'CASH').toUpperCase();
        buffers.push(this.text(`Payment: ${payMethod}`));
        buffers.push(CMD.FEED);

        if (receiptData.cashReceived) {
            buffers.push(this.text(`Cash: $${Number(receiptData.cashReceived).toFixed(2)}`));
            buffers.push(CMD.FEED);
            buffers.push(this.text(`Change: $${Number(receiptData.change || 0).toFixed(2)}`));
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
        // Rate Info
        buffers.push(CMD.SIZE_NORMAL);
        buffers.push(this.text(`Rate: 1 USD = ${RATE.toLocaleString()} LBP`));
        buffers.push(CMD.FEED);

        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.FEED);
        buffers.push(CMD.CUT);

        const fullPayload = Buffer.concat(buffers);
        await this.write(fullPayload);
    }
}

// --- Electron Application ---

const createWindow = () => {
    const win = new BrowserWindow({
        width: 1280,
        height: 800,
        fullscreen: false, // Start in windowed mode for easier debugging, user can max
        kiosk: false,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'), // compiled JS path
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: false // Needed for some native interactions often
        }
    });

    // POS URL - Default to Server
    const POS_URL = process.env.POS_URL || 'http://localhost:5003';

    console.log(`[Electron] Loading POS from: ${POS_URL}`);
    win.loadURL(POS_URL);

    // win.webContents.openDevTools(); // Optional: for debugging
};

app.whenReady().then(() => {
    const printer = new ElectronReceiptPrinter();

    ipcMain.handle('print-receipt', async (event, data) => {
        console.log('[Electron] Received print job');
        try {
            await printer.printReceipt(data);
            return { success: true };
        } catch (error: any) {
            console.error('[Electron] Print failed:', error);
            return { success: false, error: error.message };
        }
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
