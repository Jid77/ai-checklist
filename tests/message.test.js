require('dotenv').config();

const { handleMessage } = require('../src/services/message.service');

const phone = '6281234567890';

async function main() {
    const messages = [
        'Tampilkan semua task gue dong',
        // 'Apa aja kerjaan yang udah selesai?',
        // 'Besok cek stok sparepart',
        'yang 1 udh beres',
        'tampilin task gue lagi'
    ];

    for (const message of messages) {
        console.log(`\nPesan: ${message}`);

        try {
            const response = await handleMessage(message, phone);
            console.log(`Balasan: ${response}`);
        } catch (error) {
            console.error(`Error: ${error.message}`);
        }
    }
}

main().catch(console.error);