const GRAPH_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v25.0';

const sendMessage = async (to, message) => {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
        throw new Error('Konfigurasi WhatsApp API belum lengkap.');
    }

    const response = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                messaging_product: 'whatsapp',
                recipient_type: 'individual',
                to,
                type: 'text',
                text: {
                    body: message
                }
            })
        }
    );

    const result = await response.json();

    if (!response.ok) {
        console.error('WhatsApp API error:', result);
        throw new Error(
            result.error?.message || 'Gagal mengirim pesan WhatsApp.'
        );
    }

    return result;
};

module.exports = {
    sendMessage
};