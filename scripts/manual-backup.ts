import { backupService } from '../server/services/backup-service';

async function runBackup() {
    try {
        console.log('Starting manual backup...');
        const filename = await backupService.performBackup();
        console.log(`Backup completed successfully: ${filename}`);
        process.exit(0);
    } catch (error) {
        console.error('Backup failed:', error);
        process.exit(1);
    }
}

runBackup();
