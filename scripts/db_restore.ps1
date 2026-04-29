
# CalTIMS DB Restore Script (PostgreSQL 16 @ Docker)
# Usage: .\backend\scripts\db_restore.ps1 -BackupFile c:\path\to\backup.sql

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

if (-not (Test-Path $BackupFile)) {
    Write-Error "❌ Backup file not found: $BackupFile"
    exit 1
}

Write-Host "🚧 RESTORE OPERATION DETECTED..." -ForegroundColor Red
Write-Host "📄 Source: $BackupFile"

$CONTAINER_NAME = "es_db"
$DATABASE_NAME = "mydatabase"
$USER = "myuser"

# Check container status
$check = docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}"
if ($check -ne $CONTAINER_NAME) {
    Write-Error "❌ PostgreSQL container ($CONTAINER_NAME) is not running!"
    exit 1
}

Read-Host "⚠️  WARNING: This will overwrite the current database! Press Enter to continue or Ctrl+C to cancel."

Write-Host "🔄 Restoring database..." -ForegroundColor Yellow

# Drop and Re-create Public Schema to ensure clean state (Quick fix for pg_restore/psql dump)
docker exec -t $CONTAINER_NAME psql -U $USER -d $DATABASE_NAME -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Stream SQL file into container
Get-Content $BackupFile | docker exec -i $CONTAINER_NAME psql -U $USER -d $DATABASE_NAME

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Restore completed successfully! Database is now at the state of $BackupFile." -ForegroundColor Green
} else {
    Write-Host "❌ Restore failed!" -ForegroundColor Red
}
