
import { backupService } from '../services/backup-service';

async function testBackup() {
    console.log("----------------------------------------------------------------");
    console.log("Triggering Manual Backup with New Logic...");
    console.log("Target Folder Name: 'Heavys Backups' (should match guide)");
    console.log("----------------------------------------------------------------");

    try {
        const filename = await backupService.performBackup();
        console.log("\n✅ Backup completed successfully!");
        console.log("Filename:", filename);

        // Check config to see if Drive ID was saved
        const config = backupService.getConfig();
        if (config.driveFolderId) {
            console.log("✅ Drive Folder ID was resolved and saved:", config.driveFolderId);
            console.log("The backup should now be in your 'Heavys Backups' folder on Drive.");
        } else {
            console.log("⚠️ Drive Folder ID is still missing. Upload might have been skipped or failed silently.");
        }

    } catch (error: any) {
        console.error("\n❌ Backup Failed:", error.message);
    }
}

testBackup();
