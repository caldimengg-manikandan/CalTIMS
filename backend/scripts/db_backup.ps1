
# CalTIMS DB Backup Script (PostgreSQL 16 @ Docker)
# Usage: .\backend\scripts\db_backup.ps1

$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_DIR = "C:\Users\logap\OneDrive\Desktop\CalTIMS\CalTIMS\backups"
$BACKUP_FILE = "$BACKUP_DIR\caltims_backup_$TIMESTAMP.sql"

# Create backup directory if it doesn't exist
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR
}

Write-Host "🚀 Starting CalTIMS Database Backup..." -ForegroundColor Cyan
Write-Host "📅 Timestamp: $TIMESTAMP"

# Check if docker is running and container is up
$CONTAINER_NAME = "es_db" # Adjusted based on docker ps output
$check = docker ps --filter "name=$CONTAINER_NAME" --format "{{.Names}}"

if ($check -ne $CONTAINER_NAME) {
    Write-Error "❌ PostgreSQL container ($CONTAINER_NAME) is not running!"
    exit 1
}

# Perform Backup
Write-Host "💾 Dumping database to $BACKUP_FILE ..." -ForegroundColor Yellow
docker exec -t $CONTAINER_NAME pg_dump -U myuser mydatabase > $BACKUP_FILE

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backup completed successfully!" -ForegroundColor Green
    $size = (Get-Item $BACKUP_FILE).Length / 1KB
    Write-Host "📊 File Size: $($size.ToString("F2")) KB"
} else {
    Write-Host "❌ Backup failed!" -ForegroundColor Red
}
