import { receiptPrinter } from './server/printer';
import { accessSync, constants } from 'fs';

async function testPrinter() {
    console.log('--- Direct File Access Check ---');
    try {
        accessSync('/dev/usb/lp1', constants.F_OK);
        console.log('/dev/usb/lp1 exists!');
    } catch (e) {
        console.error('Direct access failed:', e);
    }
    console.log('--------------------------------');

    console.log('Testing thermal printer...');
    try {
        await receiptPrinter.testPrint();
        console.log('✓ Test print successful!');
    } catch (error) {
        console.error('✗ Print failed:', error);
        process.exit(1);
    }
}

testPrinter();
