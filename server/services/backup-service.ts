import fs from 'fs';
import path from 'path';
import { google } from 'googleapis';
import cron, { ScheduledTask } from 'node-cron';
import { spawn } from 'child_process';

// Use process.cwd() for reliable path resolution in packaged app
const __dirname = path.resolve();

const BACKUP_DIR = path.join(__dirname, 'backups');
const KEYS_DIR = path.join(__dirname, 'keys');
// Try to detect uploads directory
const PUBLIC_UPLOADS_DIR = path.join(__dirname, 'client', 'public', 'uploads');
const DIST_UPLOADS_DIR = path.join(__dirname, 'public', 'uploads');
const ROOT_UPLOADS_DIR = path.join(__dirname, 'uploads');

const SERVICE_ACCOUNT_PATH = path.join(KEYS_DIR, 'service-account.json');
const CONFIG_PATH = path.join(KEYS_DIR, 'backup-config.json');

export interface BackupConfig {
    autoBackupEnabled: boolean;
    schedule: string; // "HH:mm" (24h) or Cron expression
    localBackupPath?: string; // User defined absolute path
    includeUploads: boolean;
    driveFolderId?: string;
    lastBackup?: string;
    lastCloudBackup?: string;
}

export class BackupService {
    private cronJob: ScheduledTask | null = null;
    private config: BackupConfig = {
        autoBackupEnabled: false,
        schedule: '02:00', // Default 2 AM
        includeUploads: true,
        localBackupPath: ''
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
                const loaded = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
                this.config = { ...this.config, ...loaded };
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

        if (this.config.autoBackupEnabled && this.config.schedule) {
            let cronExpression = this.config.schedule;
            // If schedule is HH:mm, convert to cron
            if (this.config.schedule.match(/^\d{1,2}:\d{2}$/)) {
                const [hour, minute] = this.config.schedule.split(':');
                cronExpression = `${parseInt(minute)} ${parseInt(hour)} * * *`;
            }

            console.log(`Creating backup schedule: ${cronExpression} (Config: ${this.config.schedule})`);

            if (cron.validate(cronExpression)) {
                this.cronJob = cron.schedule(cronExpression, () => {
                    console.log('Starting scheduled backup...');
                    this.performBackup().catch(err => console.error('Scheduled backup failed:', err));
                });
            } else {
                console.error(`Invalid cron expression: ${cronExpression}`);
            }
        } else {
            console.log('Auto-backup is disabled or schedule is missing');
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
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19); // YYYY-MM-DD-HH-mm-ss

        // Use a temp staging directory
        const stagingDir = path.join(BACKUP_DIR, `staging_${timestamp}`);
        const zipFilename = `heavys_backup_${timestamp}.zip`;

        // Determine target path: User defined OR internal backups folder
        let targetDir = this.config.localBackupPath && this.config.localBackupPath.trim() !== ''
            ? this.config.localBackupPath
            : BACKUP_DIR;

        // Verify target dir is writable? (Simple check: attempt to access, fallback to BACKUP_DIR)
        try {
            if (!fs.existsSync(targetDir)) {
                // Try to create it if it's the custom path? 
                // Maybe better to fail or fallback? Let's try to mkdir if it looks like a valid path, otherwise fallback.
                // For now, assume it must exist or we fallback.
                console.warn(`Target directory ${targetDir} does not exist, using default.`);
                targetDir = BACKUP_DIR;
            }
            fs.accessSync(targetDir, fs.constants.W_OK);
        } catch (e) {
            console.warn(`Target directory ${targetDir} not writable/accessible, falling back to internal backups dir.`);
            targetDir = BACKUP_DIR;
        }

        const finalZipPath = path.join(targetDir, zipFilename);
        console.log(`Starting backup sequence. Target: ${finalZipPath}`);

        try {
            // 1. Create Staging Directory
            if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
            fs.mkdirSync(stagingDir);

            // 2. Dump Database
            const sqlPath = path.join(stagingDir, 'database.sql');
            await this.createPostgresBackup(sqlPath);

            // 3. Copy Uploads (if active)
            if (this.config.includeUploads) {
                // Try to find the uploads folder
                let sourceUploads = '';
                // Check common locations
                if (fs.existsSync(PUBLIC_UPLOADS_DIR)) sourceUploads = PUBLIC_UPLOADS_DIR;
                else if (fs.existsSync(DIST_UPLOADS_DIR)) sourceUploads = DIST_UPLOADS_DIR;
                else if (fs.existsSync(ROOT_UPLOADS_DIR)) sourceUploads = ROOT_UPLOADS_DIR;

                if (sourceUploads) {
                    const destUploads = path.join(stagingDir, 'uploads');
                    try {
                        fs.cpSync(sourceUploads, destUploads, { recursive: true });
                        console.log(`Copied uploads from ${sourceUploads}`);
                    } catch (err) {
                        console.error('Failed to copy uploads:', err);
                    }
                } else {
                    console.warn('Uploads directory not found, skipping images backup.');
                }
            }

            // 4. Save Metadata
            fs.writeFileSync(path.join(stagingDir, 'meta.json'), JSON.stringify({
                timestamp: new Date().toISOString(),
                version: '1.0',
                type: 'full_backup'
            }, null, 2));

            // 5. Zip it all up
            await this.zipDirectory(stagingDir, finalZipPath);

            // 6. Cleanup Staging
            fs.rmSync(stagingDir, { recursive: true, force: true });

            this.config.lastBackup = new Date().toISOString();
            this.saveConfig({});

            // 7. Optional: Upload to Drive (Legacy/Cloud option)
            // Only if service account exists AND user wants it (we can keep this logic)
            if (fs.existsSync(SERVICE_ACCOUNT_PATH) && this.config.driveFolderId) {
                try {
                    await this.uploadToDrive(finalZipPath, zipFilename);
                    this.config.lastCloudBackup = new Date().toISOString();
                    this.saveConfig({});
                } catch (e) {
                    console.error('Cloud upload failed:', e);
                }
            }

            // 8. Cleanup Old Backups (Retention Policy)
            this.cleanupOldBackups(targetDir);

            return zipFilename;
        } catch (error) {
            console.error('Backup failed:', error);
            // Cleanup staging if failed
            if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
            throw error;
        }
    }

    private createPostgresBackup(filepath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const env = process.env;
            // Use pg_dump without compression (we zip later)
            const pgDump = spawn('pg_dump', [
                '--clean',
                '--if-exists',
                '--no-owner',
                '--no-privileges',
                env.DATABASE_URL!
            ], { env: { ...process.env } });

            const fileStream = fs.createWriteStream(filepath);
            pgDump.stdout.pipe(fileStream);

            let stderr = '';
            pgDump.stderr.on('data', (d) => stderr += d.toString());

            pgDump.on('error', reject);
            pgDump.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`pg_dump exited with code ${code}: ${stderr}`));
            });
        });
    }

    private zipDirectory(sourceDir: string, outPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            // zip -r outPath . 
            // Note: outPath must be absolute or relative to CWD.
            const zip = spawn('zip', ['-r', outPath, '.'], { cwd: sourceDir });

            let stderr = '';
            zip.stderr.on('data', (d) => stderr += d.toString());

            zip.on('close', (code) => {
                if (code === 0) resolve();
                else reject(new Error(`zip process exited with code ${code}: ${stderr}`));
            });
            zip.on('error', reject);
        });
    }

    private async uploadToDrive(filepath: string, filename: string) {
        console.log('Uploading to Google Drive...');
        const drive = this.getDriveClient();

        let folderId = this.config.driveFolderId;

        // If no folder ID, try to find or create "HighwayCafe_Backups"
        if (!folderId) {
            const folderRes = await drive.files.list({
                q: "mimeType='application/vnd.google-apps.folder' and name='HighwayCafe_Backups' and trashed=false",
                fields: 'files(id, name)',
            });

            if (folderRes.data.files && folderRes.data.files.length > 0) {
                folderId = folderRes.data.files[0].id!;
            } else {
                const createRes = await drive.files.create({
                    requestBody: {
                        name: 'HighwayCafe_Backups',
                        mimeType: 'application/vnd.google-apps.folder',
                    },
                    fields: 'id',
                });
                folderId = createRes.data.id!;
            }
            this.config.driveFolderId = folderId;
            this.saveConfig({});
        }

        await drive.files.create({
            requestBody: {
                name: filename,
                parents: [folderId!],
            },
            media: {
                mimeType: 'application/zip',
                body: fs.createReadStream(filepath),
            },
            fields: 'id, name',
        });
        console.log('Upload complete');
    }

    public getBackupPath(filename: string): string | null {
        // Check both local custom path and default path
        let targetDir = this.config.localBackupPath && this.config.localBackupPath.trim() !== ''
            ? this.config.localBackupPath
            : BACKUP_DIR;

        // Security check: filename shouldn't have directory traversal
        if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
            return null;
        }

        // Check custom path first
        let filepath = path.join(targetDir, filename);
        if (fs.existsSync(filepath)) return filepath;

        // Fallback: check default dir if not found in custom dir
        let defaultPath = path.join(BACKUP_DIR, filename);
        if (fs.existsSync(defaultPath)) return defaultPath;

        return null;
    }

    public listBackups() {
        let results: any[] = [];

        // Helper to read dir
        const readToResults = (dir: string | undefined, locationType: 'local' | 'default') => {
            if (!dir || !fs.existsSync(dir)) return;
            try {
                const files = fs.readdirSync(dir)
                    .filter(f => f.endsWith('.zip') || f.endsWith('.sql') || f.endsWith('.sql.gz'))
                    .map(f => {
                        try {
                            const stats = fs.statSync(path.join(dir, f));
                            return {
                                name: f,
                                size: stats.size,
                                createdAt: stats.birthtime,
                                location: locationType,
                                path: path.join(dir, f)
                            };
                        } catch (e) { return null; }
                    })
                    .filter(Boolean);
                // @ts-ignore
                results = [...results, ...files];
            } catch (e) {
                console.error(`Error reading backups from ${dir}:`, e);
            }
        };

        // Read default dir
        readToResults(BACKUP_DIR, 'default');

        // Read custom dir if set and different
        if (this.config.localBackupPath && this.config.localBackupPath.trim() !== '' && this.config.localBackupPath !== BACKUP_DIR) {
            readToResults(this.config.localBackupPath, 'local');
        }

        // Sort by date desc
        return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    public deleteBackup(filename: string) {
        const filepath = this.getBackupPath(filename);
        if (filepath && fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            return true;
        }
        return false;
    }

    private cleanupOldBackups(dir: string) {
        try {
            if (!fs.existsSync(dir)) return;

            // Look for .zip files identifying as our backups
            const files = fs.readdirSync(dir)
                .filter(f => f.startsWith('heavys_backup_') && f.endsWith('.zip'))
                .map(f => ({
                    name: f,
                    path: path.join(dir, f),
                    time: fs.statSync(path.join(dir, f)).mtime.getTime()
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
