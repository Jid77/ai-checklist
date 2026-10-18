require('dotenv').config();

const { parseMessage } = require('../src/ai/parser');

const messages = [
    'Tampilkan task gue',
    'Task 1 beres',
    'GR yang pending udah kelar',
    'Cek stok sparepart'
];

async function main() {
    for (const message of messages) {
        console.log(`Pesan: ${message}`);

        try {
            const result = await parseMessage(message);
            console.log('Hasil:', result);
        } catch (error) {
            console.error('Error:', error.message);
        }

        console.log('--------------------');
    }
}

main().catch(console.error);