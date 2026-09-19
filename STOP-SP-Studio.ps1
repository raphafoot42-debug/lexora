$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force
    Write-Host "SP Studio arrêté."
} else {
    Write-Host "Aucun processus sur le port 3000."
}
