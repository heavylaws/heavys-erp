
import { storage } from './server/storage';

(async () => {
    try {
        const users = await storage.getAllUsers();
        console.log('Existing users:', users.map(u => u.username));

        const kioskUser = await storage.getUserByUsername('kiosk');
        if (kioskUser) {
            console.log('✅ Kiosk user exists.');
        } else {
            console.log('❌ Kiosk user MISSING.');
        }
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
})();
