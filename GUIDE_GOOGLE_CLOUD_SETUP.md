# 🐧 Google Cloud Setup Guide (Step-by-Step)

This guide will walk you through creating a "Service Account" (a robot user) that can upload files to your Google Drive.

## Step 1: Create a Project
1.  Open this link: **[Google Cloud Console](https://console.cloud.google.com/)**
2.  Log in with your Google/Gmail account.
3.  Look at the top-left blue bar (next to the Google Cloud logo). It might say "Select a project" or a project name. **Click it.**
4.  In the popup window, click **New Project** (top right of the popup).
5.  **Project Name**: Enter `Heavys-Backup`.
6.  Click **Create**.
7.  Wait a few seconds. A notification will appear saying "Project Created". Click **SELECT PROJECT** (or select it from the top dropdown again).

## Step 2: Enable Google Drive API
1.  Click the **Hamburger Menu** (☰) in the top-left corner.
2.  Hover over **APIs & Services**, then click **Library**.
3.  In the search bar, type `Google Drive API` and press Enter.
4.  Click on the result named **Google Drive API**.
5.  Click the blue **ENABLE** button.

## Step 3: Create the Service Account
1.  Click the **Hamburger Menu** (☰) again.
2.  Hover over **IAM & Admin**, then click **Service Accounts**.
3.  Click **+ CREATE SERVICE ACCOUNT** (top center).
4.  **Step 1 (Details)**:
    *   **Service account name**: Enter `backup-bot`.
    *   Click **CREATE AND CONTINUE**.
5.  **Step 2 (Permissions)**:
    *   Click the "Select a role" box.
    *   Type `Editor` in the filter.
    *   Select **Basic** > **Editor** (or just "Editor").
    *   Click **CONTINUE**.
6.  **Step 3 (Access access)**:
    *   Skip this. Just click **DONE**.

## Step 4: Download the Key (The Important Part!)
1.  You should now see a list with your new service account (e.g., `backup-bot@heavys-backup-12345.iam.gserviceaccount.com`).
2.  Click the **Pencil Icon** (Edit) on the right side of that row.
3.  Click the **KEYS** tab (near the top of the page).
4.  Click **ADD KEY** > **Create new key**.
5.  Select **JSON** (it should be selected by default).
6.  Click **CREATE**.
7.  A `.json` file will download to your computer.
    *   **Note**: This is your secret key. Do not share it.

## Step 5: Connect to Heavy's ERP
1.  Go back to your **Heavy's ERP Admin Dashboard** > **System Backups**.
2.  Find the **Legacy Cloud Sync** section on the right.
3.  Click **Choose File** and select the `.json` file you just downloaded.
4.  Click **Test Connection**.

## Step 6: See Your Backups (Sharing)
By default, the robot uploads files to its *own* private drive space. To see them in *your* Drive:
1.  Copy the **Service Account Email** (from Step 4, it looks like an email address).
2.  Go to your personal **[Google Drive](https://drive.google.com/)**.
3.  Create a new folder called `Heavys Backups`.
4.  Right-click the folder > **Share**.
5.  Paste the **Service Account Email** into the "Add people" box.
6.  Make sure it says **Editor**.
7.  Click **Send**.

Now, when the system backs up, files will appear in that folder!
