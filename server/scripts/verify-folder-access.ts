
import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';

const __dirname = path.resolve();
const SERVICE_ACCOUNT_PATH = path.join(__dirname, 'keys', 'service-account.json');
const TARGET_FOLDER_ID = '1liikDs2Xlku0NE-rQz1UZKOgPdQ6lSeD';

async function verifyAccess() {
    console.log("---------------------------------------------------");
    console.log("Debugging Drive Access...");

    if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
        console.error("❌ Key file not found at:", SERVICE_ACCOUNT_PATH);
        return;
    }

    const keyContent = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf-8'));
    console.log(`🤖 Service Account Email: ${keyContent.client_email}`);
    console.log(`📂 Target Folder ID: ${TARGET_FOLDER_ID}`);
    console.log("---------------------------------------------------");

    const auth = new google.auth.GoogleAuth({
        keyFile: SERVICE_ACCOUNT_PATH,
        scopes: ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive.metadata.readonly'],
    });

    const drive = google.drive({ version: 'v3', auth });

    try {
        // 0. List ALL visible folders
        console.log("0. Listing ALL folders visible to this bot:");
        const listRes = await drive.files.list({
            q: "mimeType='application/vnd.google-apps.folder' and trashed=false",
            fields: 'files(id, name, owners)',
            pageSize: 10
        });

        if (listRes.data.files && listRes.data.files.length > 0) {
            listRes.data.files.forEach(f => {
                console.log(`   - [${f.id}] ${f.name} (Owner: ${f.owners?.[0]?.emailAddress})`);
            });
        } else {
            console.log("   ⚠️ No folders found. The bot sees NOTHING.");
        }
        console.log("---------------------------------------------------");

        // 1. Check specific folder
        console.log("1. Verifying target folder visibility...");
        const folder = await drive.files.get({
            fileId: TARGET_FOLDER_ID,
            fields: 'id, name, capabilities'
        });
        console.log(`   ✅ Found folder: "${folder.data.name}"`);
        console.log(`   Capabilities: Can Add Children? ${folder.data.capabilities?.canAddChildren}`);

        if (!folder.data.capabilities?.canAddChildren) {
            console.error("   ❌ PERMISSION DENIED: The bot specifically cannot add files to this folder.");
            console.error("   Please check that the bot is an EDITOR.");
            return;
        }

        // 2. Try to upload a small test file
        console.log("2. Attempting test upload...");
        const res = await drive.files.create({
            requestBody: {
                name: 'test_connection.txt',
                parents: [TARGET_FOLDER_ID],
            },
            media: {
                mimeType: 'text/plain',
                body: 'Hello from Heavys ERP! This confirms the connection works.',
            },
            fields: 'id, name, webViewLink',
        });

        console.log("   ✅ Upload Successful!");
        console.log("   File ID:", res.data.id);
        console.log("   Link:", res.data.webViewLink);

        // 3. Clean up (delete the test file)
        console.log("3. Cleaning up test file...");
        await drive.files.delete({ fileId: res.data.id! });
        console.log("   ✅ Cleanup complete.");

    } catch (error: any) {
        console.error("❌ ACCESS FAILED:");
        if (error.code === 404) {
            console.error("   Folder not found. The bot cannot see the folder ID you provided.");
        } else {
            console.error(error.message);
        }
    }
}

verifyAccess();
