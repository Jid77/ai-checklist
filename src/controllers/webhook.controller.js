const { handleMessage } = require('../services/message.service');
const whatsapp = require('../channels/whatsapp');

const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

    if (
        mode === 'subscribe' &&
        verifyToken &&
        token === verifyToken
    ) {
        console.log('WhatsApp webhook berhasil diverifikasi.');
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
};

const receiveWebhook = async (req, res) => {
    // Meta mengharapkan respons cepat agar tidak menganggap webhook gagal.
    res.sendStatus(200);

    try {
        const body = req.body;

        if (body.object !== 'whatsapp_business_account') {
            return;
        }

        for (const entry of body.entry || []) {
            for (const change of entry.changes || []) {
                if (change.field !== 'messages') {
                    continue;
                }

                const value = change.value;
                const messages = value.messages || [];

                for (const message of messages) {
                    // Tahap awal: hanya proses pesan teks.
                    if (message.type !== 'text') {
                        continue;
                    }

                    const phone = message.from;
                    const text = message.text?.body?.trim();

                    if (!phone || !text) {
                        continue;
                    }

                    try {
                        const reply = await handleMessage(text, phone);

                        if (reply) {
                            await whatsapp.sendMessage(phone, reply);
                        }
                    } catch (error) {
                        console.error(
                            `Gagal memproses pesan dari ${phone}:`,
                            error
                        );

                        try {
                            await whatsapp.sendMessage(
                                phone,
                                'Maap, pesan kamu belum bisa diproses. Coba lagi sebentar, yaw.'
                            );
                        } catch (sendError) {
                            console.error(
                                'Gagal mengirim pesan error:',
                                sendError.message
                            );
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Gagal memproses webhook WhatsApp:', error);
    }
};

module.exports = {
    verifyWebhook,
    receiveWebhook
};