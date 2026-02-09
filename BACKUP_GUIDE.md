# System Backup Guide

## How to Set Up Automatic Cloud Sync

This system is designed to work with your existing cloud storage ("Local-First Backup"). This means you don't need complicated API keys. You simply tell the system where to save files, and your cloud app (Google Drive, Dropbox, etc.) does the rest.

### Step 1: Install Cloud Software
Ensure you have the desktop application for your preferred cloud service installed on this computer:
- **Google Drive for Desktop** (Windows/Mac)
- **Dropbox** (Linux/Windows/Mac)
- **OneDrive** (Windows/Mac)

### Step 2: Create a Backup Folder
Create a folder in your cloud drive where you want backups to go.
*   Example: `Documents/Google Drive/Heavys_Backups`

### Step 3: Configure Heavy's ERP
1.  Go to the **System Backups** page in the Admin Dashboard.
2.  In the **"Local Backup Folder Path"** field, paste the full path to the folder you created in Step 2.
    *   *Tip: You can usually right-click the folder in your file explorer and select "Copy as Path" or "Properties" to find this.*
3.  Set the **"Daily Backup Time"** to a time when the computer is usually on (e.g., `02:00` AM or `23:00` PM).
4.  Ensure **"Automatic Backup"** is toggled **ON**.
5.  Ensure **"Include Uploads & Images"** is toggled **ON** if you want to backup product photos.

---

## 🐧 Linux / Headless Server Setup
If you are running on a **Linux Server** (like Ubuntu/Mint) and cannot install the Google Drive desktop app, you must use the **Direct Cloud Sync** method.

👉 **[Read the Google Cloud Setup Guide](./GUIDE_GOOGLE_CLOUD_SETUP.md)**

This guide explains how to generate the required "Key File" to upload directly to Google Drive without any sync software.
