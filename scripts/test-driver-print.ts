import { spawn } from 'child_process';

const printText = (text: string) => {
    return new Promise((resolve, reject) => {
        // Use standard driver queue, NO raw option
        const lp = spawn('lp', ['-d', 'Printer-POS-80']);

        lp.stdin.write(text);
        lp.stdin.end();

        lp.on('close', (code) => {
            if (code === 0) {
                console.log('Success: Text sent to Printer-POS-80');
                resolve(true);
            } else {
                console.error(`Error: lp exited with ${code}`);
                reject(new Error(`lp failed with ${code}`));
            }
        });

        lp.on('error', (err) => {
            console.error('Spawn Error:', err);
            reject(err);
        });

        lp.stderr.on('data', (data) => console.error('lp stderr:', data.toString()));
    });
};

console.log('Testing driver-based text printing...');
printText(`
--------------------------------
HIGHWAY CAFE POS
      Driver Text Mode
--------------------------------
Item              Qty   Price
--------------------------------
Test Item          1    $1.00
--------------------------------
Total: $1.00
--------------------------------
` + new Date().toLocaleString() + '\n\n\n')
    .then(() => console.log('Done'))
    .catch(e => console.error(e));
