const path = require('path');
const fs = require('fs');

async function startBaileys() {
    const {
        default: makeWASocket,
        useMultiFileAuthState,
        DisconnectReason
    } = await import('@whiskeysockets/baileys');

    const authPath = path.join(process.cwd(), '.baileys_auth');

    if (!fs.existsSync(authPath)) {
        fs.mkdirSync(authPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(authPath);

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: require('pino')({ level: 'silent' }),
        browser: ['AI Checklist', 'Chrome', '1.0.0']
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\nScan QR berikut menggunakan WhatsApp:\n');
            const qrcode = await import('qrcode-terminal');
            qrcode.default.generate(qr, { small: true });
        }

        if (connection === 'open') {
            console.log('WhatsApp AI Checklist berhasil terhubung!');
        }

        if (connection === 'close') {
            const statusCode =
                lastDisconnect?.error?.output?.statusCode;

            if (statusCode === DisconnectReason.loggedOut) {
                console.log(
                    'Sesi WhatsApp logout. Hapus sesi lama dan scan QR ulang jika diperlukan.'
                );
                return;
            }

            console.log('Koneksi terputus. Mencoba menghubungkan ulang...');
            setTimeout(() => startBaileys(), 3000);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;

        for (const msg of messages) {
            if (!msg.message || msg.key.fromMe) continue;

            const jid = msg.key.remoteJid;

            // Hanya menerima chat pribadi, bukan grup.
            if (!jid || jid.endsWith('@g.us') || jid === 'status@broadcast') {
                continue;
            }

            const phone = jid.split('@')[0];

            const text =
                msg.message.conversation ||
                msg.message.extendedTextMessage?.text;

            if (!text?.trim()) continue;

            console.log(`Pesan masuk dari ${phone}`);

            try {
                const { handleMessage } = require('../services/message.service');
                const reply = await handleMessage(text.trim(), phone);

                if (reply) {
                    await sock.sendMessage(jid, { text: reply });
                    console.log(`Balasan terkirim ke ${phone}`);
                }
            } catch (error) {
                console.error('Gagal memproses pesan:', error.message);

                try {
                    await sock.sendMessage(jid, {
                        text: 'Maaf, pesan kamu belum bisa diproses. Coba lagi nanti, ya.'
                    });
                } catch (sendError) {
                    console.error('Gagal mengirim balasan:', sendError.message);
                }
            }
        }
    });

    return sock;
}

module.exports = { startBaileys };