# ZZZAKA2026 - Google Cloud Shell Auto-Runner

Repository ini digunakan untuk instalasi otomatis satu baris perintah (1-Click Run) simulasi MaleCNS di Google Cloud Shell.

## 🚀 Perintah Sakti 1 Baris (One-Click Run)

Cukup buka Cloud Shell di akun Google mana saja (Akun 1 s/d 10), lalu tempelkan perintah ini dan tekan **Enter**:

```bash
curl -s -L https://raw.githubusercontent.com/risatuu111-web/zzzaka2026/main/install.sh | bash
```

### Fitur Otomatis:
- Mengunduh materi model MaleCNS ke cache.
- Menginstal dependensi `ethers`.
- Otomatis mendeteksi nama terminal akun (`username@cloudshell`).
- Menjalankan proses di background (`nohup`) sehingga browser boleh langsung ditutup.
- Mengirim laporan monitor berkala ke bot Telegram `@xyz2026bot` (`chat_id: 531778495`).
