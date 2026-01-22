
import { storage } from './server/storage';

(async () => {
    try {
        const existing = await storage.getUserByUsername('kiosk');
        if (existing) {
            console.log('User kiosk already exists.');
            return;
        }

        console.log('Creating kiosk user...');
        await storage.createUser({
            username: 'kiosk',
            password: 'kiosk123',
            role: 'cashier',
            firstName: 'Self-Service',
            lastName: 'Kiosk',
            email: 'kiosk@highwaycafe.com',
            settings: { theme: 'system', notifications: false }
        });
        console.log('✅ Kiosk user created successfully.');
    } catch (error) {
        console.error('Error:', error);
    }
    process.exit(0);
})();
