import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import cron, { ScheduledTask } from 'node-cron';
import { spawn } from 'child_process';
// Use process.cwd() for reliable path resolution in packaged app
const __dirname = path.resolve();

const BACKUP_DIR = path.join(__dirname, 'backups');
const KEYS_DIR = path.join(__dirname, 'keys');
const SERVICE_ACCOUNT_PATH = path.join(KEYS_DIR, 'service-account.json');
const CONFIG_PATH = path.join(KEYS_DIR, 'backup-config.json');

interface BackupConfig {
    autoBackupEnabled: boolean;
    schedule: string; // Cron expression
    driveFolderId?: string;
    lastBackup?: string;
    lastCloudBackup?: string;
}

export class BackupService {
    private cronJob: ScheduledTask | null = null;
    private config: BackupConfig = {
        autoBackupEnabled: false,
        schedule: '0 2 * * *', // Default: 2:00 AM daily
    };

    constructor() {
        this.ensureDirectories();
        this.loadConfig();
        this.setupSchedule();
    }

    private ensureDirectories() {
        if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
        if (!fs.existsSync(KEYS_DIR)) fs.mkdirSync(KEYS_DIR, { recursive: true });
    }

    private loadConfig() {
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                this.config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
            }
        } catch (error) {
            console.error('Failed to load backup config:', error);
        }
    }

    public saveConfig(newConfig: Partial<BackupConfig>) {
        this.config = { ...this.config, ...newConfig };
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(this.config, null, 2));
        this.setupSchedule(); // Re-init schedule if changed
    }

    public getConfig() {
        const hasKey = fs.existsSync(SERVICE_ACCOUNT_PATH);
        return { ...this.config, hasServiceAccount: hasKey };
    }

    public setupSchedule() {
        if (this.cronJob) {
            this.cronJob.stop();
            this.cronJob = null;
        }

        if (this.config.autoBackupEnabled) {
            console.log(`Creating backup schedule: ${this.config.schedule}`);
            this.cronJob = cron.schedule(this.config.schedule, () => {
                console.log('Starting scheduled backup...');
                this.performBackup().catch(err => console.error('Scheduled backup failed:', err));
            });
        } else {
            console.log('Auto-backup is disabled');
        }
    }

    public async saveServiceAccountKey(keyContent: string) {
        // Validate JSON parsing
        JSON.parse(keyContent);
        fs.writeFileSync(SERVICE_ACCOUNT_PATH, keyContent);
    }

    private getDriveClient() {
        if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            throw new Error('Service account key not found');
        }

        const auth = new google.auth.GoogleAuth({
            keyFile: SERVICE_ACCOUNT_PATH,
            scopes: ['https://www.googleapis.com/auth/drive.file'],
        });

        return google.drive({ version: 'v3', auth });
    }

    public async testConnection() {
        const drive = this.getDriveClient();
        const res = await drive.files.list({ pageSize: 1 });
        return res.status;
    }

    public async performBackup() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `auto_backup_${timestamp}.sql.gz`;
        const filepath = path.join(BACKUP_DIR, filename);

        console.log(`Starting backup to ${filepath}`);

        try {
            await this.createPostgresBackup(filepath);

            this.config.lastBackup = new Date().toISOString();
            this.saveConfig({}); // Persist timestamp

            if (this.config.autoBackupEnabled && fs.existsSync(SERVICE_ACCOUNT_PATH)) {
                await this.uploadToDrive(filepath, filename);
                this.config.lastCloudBackup = new Date().toISOString();
                this.saveConfig({});
            }

            // Cleanup old local files (keep last 30)
            this.cleanupOldBackups();

            return filename;
        } catch (error) {
            console.error('Backup failed:', error);
            throw error;
        }
    }

    private createPostgresBackup(filepath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // Need db connection details from env
            const env = process.env;

            const pgDump = spawn('pg_dump', [
                '--clean',
                '--if-exists',
                '--no-owner', // Good for cross-server restores
                '--no-privileges',
                env.DATABASE_URL!
            ], {
                env: { ...process.env } // Ensure PGPASSWORD etc are passed if needed
            });

            const gzip = spawn('gzip');

            // Create write stream
            const fileStream = fs.createWriteStream(filepath);

            pgDump.stdout.pipe(gzip.stdin);
            gzip.stdout.pipe(fileStream);

            pgDump.on('error', (err) => reject(err));
            gzip.on('error', (err) => reject(err));

            gzip.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`gzip process exited with code ${code}`));
            });
        });
    }

    private async uploadToDrive(filepath: string, filename: string) {
        console.log('Uploading to Google Drive...');
        const drive = this.getDriveClient();

        // Check if folder exists, create if not (optional, but good practice)
        let folderId = this.config.driveFolderId;
        if (!folderId) {
            // Search for "HighwayCafe_Backups"
            const folderRes = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.folder' and name='HighwayCafe_Backups' and trashed=false",
                fields: 'files(id, name)',
            });

            if (folderRes.data.files && folderRes.data.files.length > 0) {
                folderId = folderRes.data.files[0].id!;
            } else {
                // Create it
                const createRes = await drive.files.create({
                    requestBody: {
                        name: 'HighwayCafe_Backups',
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                });
                folderId = createRes.data.id!;
            }

            this.config.driveFolderId = folderId; // Cache it
            this.saveConfig({});
        }

        await drive.files.create({
            requestBody: {
                name: filename,
                parents: [folderId],
            },
            media: {
                mimeType: 'application/x-gzip',
                body: fs.createReadStream(filepath),
            },
            fields: 'id, name, webViewLink',
        });

        console.log('Upload complete');
    }

    private cleanupOldBackups() {
        try {
            const files = fs.readdirSync(BACKUP_DIR)
                .filter(f => f.endsWith('.sql.gz'))
                .map(f => ({
                    name: f,
                    path: path.join(BACKUP_DIR, f),
                    time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime()
                }))
                .sort((a, b) => b.time - a.time); // Newest first

            // Keep 30
            if (files.length > 30) {
                const toDelete = files.slice(30);
                toDelete.forEach(f => {
                    fs.unlinkSync(f.path);
                    console.log(`Deleted old backup: ${f.name}`);
                });
            }
        } catch (e) {
            console.error('Cleanup error:', e);
        }
    }
}

export const backupService = new BackupService();
