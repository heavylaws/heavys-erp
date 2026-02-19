
import { backupService } from '../services/backup-service';

async function check() {
    console.log("Testing Google Drive Connection...");
    try {
        const status = await backupService.testConnection();
        console.log("SUCCESS: Connection Status", status);
        if (status === 200) {
            console.log("✅ Google Drive API is accessible. The billing error might be for other services.");
        } else {
            console.log("⚠️ Connection returned status:", status);
        }
    } catch (error: any) {
        console.error("❌ CONNECTION FAILED:");
        console.error(error.message);
        console.log("\nThis confirms that the Billing Account issue is blocking the API.");
    }
}

check();
