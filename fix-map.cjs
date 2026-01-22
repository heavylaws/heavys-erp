
const fs = require('fs');

// 1. Read existing CP864 Map
const cp864Content = fs.readFileSync('CP864.TXT', 'utf8');
const map = {};
const lines = cp864Content.split('\n');
for (const line of lines) {
    if (!line.startsWith('0x')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 2) continue;
    const cp864Hex = parseInt(parts[0], 16);
    const unicodeHex = parseInt(parts[1], 16);
    if (!isNaN(cp864Hex) && !isNaN(unicodeHex)) {
        map[unicodeHex] = cp864Hex;
    }
}

// 2. Read ArabicShaper structures
const shaperContent = fs.readFileSync('node_modules/arabic-persian-reshaper/ArabicShaper.js', 'utf8');
const match = shaperContent.match(/var charsMap = \[\s*([\s\S]+?)\]\s*,\s*combCharsMap/);
if (!match) {
    console.error('Could not find charsMap');
    process.exit(1);
}

let charsMapStr = match[1];
console.log('charsMapStr start:', charsMapStr.substring(0, 100));
charsMapStr = charsMapStr.replace(/\/\*[\s\S]*?\*\//g, '');
const charsMap = eval('[' + charsMapStr + ']');
console.log('First row:', charsMap[0]);
console.log('Parsed charsMap length:', charsMap.length);

// Debug map content
console.log('Map size:', Object.keys(map).length);
console.log('Check FE91 in map:', map[0xFE91]);

// 3. Fill gaps
const outputMap = { ...map };

charsMap.forEach(row => {
    if (!Array.isArray(row)) return;
    const [base, iso, ini, med, fin] = row;
    if (base === 0x0628) {
        console.log('Found Beh row:', row);
        console.log('Map check:', map[iso], map[ini], map[med], map[fin]);
    }

    const forms = [
        { type: 'iso', code: iso },
        { type: 'ini', code: ini },
        { type: 'med', code: med },
        { type: 'fin', code: fin }
    ];

    // Find available forms in CP864
    const available = {};
    forms.forEach(f => {
        if (f.code && map[f.code]) {
            available[f.type] = map[f.code];
        }
    });

    // Fill missing
    forms.forEach(f => {
        if (f.code && !outputMap[f.code]) {
            if (base === 0x0628 && f.type === 'med') {
                console.log('Beh Medial Check:');
                console.log('Code:', f.code, 'Hex:', f.code.toString(16));
                console.log('Available:', available);
                console.log('Fallback logic start...');
            }

            let fallback = null;
            if (f.type === 'med') {
                if (available.ini) fallback = available.ini;
                else if (available.fin) fallback = available.fin;
                else if (available.iso) fallback = available.iso;
            } else if (f.type === 'fin') {
                if (available.iso) fallback = available.iso;
                else if (available.ini) fallback = available.ini;
            } else if (f.type === 'ini') {
                if (available.med) fallback = available.med;
                else if (available.iso) fallback = available.iso;
            } else if (f.type === 'iso') {
                if (available.fin) fallback = available.fin; // rare
            }

            if (fallback) {
                console.log(`Mapping missing ${f.type} (0x${f.code.toString(16)}) -> 0x${fallback.toString(16)}`);
                outputMap[f.code] = fallback;
            }
        }
    });
});

// 4. Generate Output
let tsContent = 'export const CP864_MAPPING: { [key: number]: number } = {\n';
Object.keys(outputMap).sort((a, b) => parseInt(a) - parseInt(b)).forEach(key => {
    tsContent += `    ${key}: 0x${outputMap[key].toString(16)},\n`;
});
tsContent += '};\n';

fs.writeFileSync('server/cp864-map.ts', tsContent);
console.log('Map updated.');
