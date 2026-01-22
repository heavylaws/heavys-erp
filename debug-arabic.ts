
// @ts-ignore
import ArabicPersianReshaper from 'arabic-persian-reshaper';
const { ArabicShaper } = ArabicPersianReshaper;
import { CP864_MAPPING } from './server/cp864-map';

const text = "كبسة كرتون";

console.log('Original:', text);

// Reshape
const reshaped = ArabicShaper.convertArabic(text);
console.log('Reshaped (chars):', reshaped);

// Analyze
console.log('\n--- Character Analysis ---');
for (let i = 0; i < reshaped.length; i++) {
    const char = reshaped[i];
    const code = char.charCodeAt(0);
    const hex = '0x' + code.toString(16).padStart(4, '0');
    const mapped = CP864_MAPPING[code];
    const mappedHex = mapped ? '0x' + mapped.toString(16).padStart(2, '0') : 'UNDEFINED';

    console.log(`Char: ${char} | Code: ${code} (${hex}) | Mapped: ${mappedHex}`);
}
