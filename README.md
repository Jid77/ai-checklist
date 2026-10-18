# AI Checklist

AI Checklist adalah aplikasi manajemen task berbasis percakapan yang dirancang untuk digunakan melalui WhatsApp.

Pengguna dapat menambahkan task, melihat daftar task, menyelesaikan task, dan mengembalikan task yang sudah selesai ke status pending menggunakan bahasa sehari-hari.

## Fitur

- Menambahkan task melalui pesan teks.
- Menampilkan task yang belum selesai.
- Menampilkan task yang sudah selesai.
- Menyelesaikan task berdasarkan nomor atau judul.
- Mengembalikan task ke status pending.
- Memproses task berdasarkan identitas pengguna.
- Menggunakan AI untuk memahami instruksi pengguna.
- Integrasi WhatsApp Cloud API.

## Teknologi

- Node.js
- Express.js
- PostgreSQL
- Prisma ORM
- Google Gemini API
- WhatsApp Cloud API

## Persyaratan

- Node.js
- npm
- PostgreSQL
- Google Gemini API key
- Meta Developer App dengan WhatsApp Cloud API

## Instalasi

Clone repository:

```bash
git clone https://github.com/USERNAME/ai-checklist.git
cd ai-checklist
```

Install dependency:

```bash
npm ci
```

Buat file `.env` berdasarkan `.env.example`, kemudian isi kredensial yang diperlukan.

Jalankan migrasi database:

```bash
npx prisma migrate deploy
```

Jalankan aplikasi:

```bash
npm start
```

## Environment Variables

Konfigurasi aplikasi disimpan dalam file `.env`.

Variabel yang diperlukan meliputi:

- `DATABASE_URL`
- `GEMINI_API_KEY`
- `WHATSAPP_API_VERSION`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_VERIFY_TOKEN`

Jangan mengunggah file `.env` atau kredensial rahasia ke repository.

## Pengembangan

Jalankan aplikasi dalam mode pengembangan:

```bash
npm run dev
```

Jalankan pengujian:

```bash
npm test
```

## Deployment

Aplikasi direncanakan berjalan pada VPS Linux dengan PostgreSQL, HTTPS, dan webhook WhatsApp Cloud API.

## Status

Dalam pengembangan.