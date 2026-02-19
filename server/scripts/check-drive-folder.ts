
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'keys', 'service-account.json');

async function checkExits() {
    console.log("Checking Service Account...");
    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ Key file not found at:", SERVICE_ACCOUNT_PATH);
        return;
    }

    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    const drive = google.drive({ version: 'v3', auth });

    console.log("Looking for folder 'Heavys Backups'...");

    try {
        const folderRes = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and name='Heavys Backups' and trashed=false",
            fields: 'files(id, name)',
        });

        if (folderRes.data.files && folderRes.data.files.length > 0) {
            console.log("✅ Found existing folder:", folderRes.data.files[0].name, "ID:", folderRes.data.files[0].id);
        } else {
            console.log("⚠️ Folder not found. Attempting to create...");
            const createRes = await drive.files.create({
                requestBody: {
                    name: 'Heavys Backups',
                    mimeType: 'application/vnd.google-apps.folder',
                },
                fields: 'id, name',
            });
            console.log("✅ Created new folder:", createRes.data.name, "ID:", createRes.data.id);
        }
    } catch (error: any) {
        console.error("❌ Error:", error.message);
    }
}

checkExits();
