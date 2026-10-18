require('dotenv').config();

const { startBaileys } = require('./channels/baileys');

startBaileys().catch((error) => {
    console.error('Gagal menjalankan WhatsApp:', error);
    process.exit(1);
});