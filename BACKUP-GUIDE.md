orDatabase Backup & Restore Guide
================================

This document explains how to create and restore logical backups of the Highway Cafe POS PostgreSQL database when running via Docker Compose.

Why Two Formats?
----------------
The backup script generates:
1. Plain SQL dump (compressed) – human-readable, easy to inspect or partially restore
2. pg_dump custom format – better for selective restore or faster large restores

Scripts Added
-------------
`scripts/backup-db.sh` – creates backups under `backups/` (default)  
`scripts/restore-db.sh` – restores a selected backup into the running postgres container

Prerequisites
-------------
* Docker + Docker Compose plugin (or legacy docker-compose)
* The postgres service running (e.g. `docker compose up -d` in project root)

Creating a Backup
-----------------
Run:
```
./scripts/backup-db.sh
```
Optional custom output directory:
```
./scripts/backup-db.sh my_backups
```
Output files (example):
```
backups/
  backup_20250928_142530.sql.gz
  backup_20250928_142530.sql.gz.sha256
  backup_20250928_142530.sql.custom
  backup_20250928_142530.sql.custom.sha256
```

Transferring to Remote Machine
------------------------------
Copy the desired files to the remote host (scp / rsync). At minimum you need one of:
* The `.sql.gz` file (plain dump) OR
* The `.custom` file (custom format)

Restoring on Remote
-------------------
1. Clone repo & start services (ensure postgres up):
```
git clone https://github.com/heavylaws/Cafe24Pos.git
cd Cafe24Pos
docker compose -f docker-compose.production.yml up -d postgres
```
2. Copy backup file into project directory.
3. Run restore:
```
./scripts/restore-db.sh backups/backup_YYYYmmdd_HHMMSS.sql.gz
```
   Or for custom format:
```
./scripts/restore-db.sh backups/backup_YYYYmmdd_HHMMSS.sql.custom
```

Environment Variables
---------------------
The scripts honor:
```
DB_NAME (default highway_cafe)
DB_USER (default postgres)
POSTGRES_PASSWORD (default highway_cafe_2024)
```
Export or prefix them if the remote differs:
```
POSTGRES_PASSWORD=mysecret ./scripts/restore-db.sh backups/backup_....sql.gz
```

Data Safety & Verification
--------------------------
After restore you can verify:
```
docker compose exec -T postgres psql -U postgres -d highway_cafe -c "\dt" | head
```
Optionally compare checksum:
```
sha256sum -c backups/backup_....sql.gz.sha256
```

Automated / Cron Backups
------------------------
Example cron (daily at 02:30) on host machine:
```
30 2 * * * cd /opt/highway-cafe-pos && ./scripts/backup-db.sh >> backups/cron.log 2>&1
```
Rotate old backups with a simple find:
```
find backups -type f -mtime +14 -name 'backup_*.sql.*' -delete
```

Excluding Large Dumps from Git
------------------------------
Add to `.gitignore` (if not already):
```
backups/
*.sql
*.sql.gz
*.custom
*.sha256
```

Next Steps
----------
* (Optional) Integrate a REST endpoint to trigger a backup and stream it.
* (Optional) Encrypt backups at rest using gpg.

Enjoy reliable migrations + restores!
