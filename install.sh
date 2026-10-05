#!/bin/bash
# ==============================================================================
# ONE-CLICK AUTO INSTALLER & RUNNER - GOOGLE CLOUD SHELL
# REPO: https://github.com/risatuu111-web/zzzaka2026
# ==============================================================================

echo "================================================================================"
echo " 🚀 MEMULAI PROSES INSTALASI OTOMATIS CLOUD SHELL // ZZZAKA2026"
echo "================================================================================"

# 1. Download Materi Model Connectome MaleCNS
echo "[1/4] Mengunduh materi model MaleCNS..."
mkdir -p connectome_cache
curl -s -L https://www.flyaiworld.com/simulation/connectome/brain.json -o connectome_cache/brain.json
curl -s -L https://www.flyaiworld.com/simulation/connectome/meta.bin -o connectome_cache/meta.bin
curl -s -L https://www.flyaiworld.com/simulation/connectome/weights_p0.bin -o connectome_cache/weights_p0.bin
curl -s -L https://www.flyaiworld.com/simulation/connectome/weights_p1.bin -o connectome_cache/weights_p1.bin

# 2. Install Dependensi Ethers
echo "[2/4] Menginstal dependensi ethers..."
npm install ethers@6.13.2 > /dev/null 2>&1

# 3. Download Runner Script dari GitHub
echo "[3/4] Menyiapkan skrip runner pintar..."
curl -s -L https://raw.githubusercontent.com/risatuu111-web/zzzaka2026/main/run_cloudshell.mjs -o run_cloudshell.mjs

# 4. Matikan Proses Lama Jika Ada & Jalankan di Background
echo "[4/4] Menjalankan miner di background (NOHUP)..."
pkill -f run_cloudshell.mjs > /dev/null 2>&1
nohup node --max-old-space-size=4096 run_cloudshell.mjs > miner.log 2>&1 &

echo "================================================================================"
echo " ✅ SUKSES! Miner sudah aktif berjalan 100% di background Cloud Shell!"
echo " 📱 Laporan otomatis dikirim ke Telegram setiap 1 menit."
echo " 🚪 Browser / Laptop sekarang AMAN untuk ditutup total."
echo "================================================================================"
