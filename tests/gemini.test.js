require('dotenv').config();

async function main() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error('GEMINI_API_KEY belum ditemukan di file .env');
    }

    const { GoogleGenAI } = await import('@google/genai');

    const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY
    });

    const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: 'Balas dengan kalimat: Gemini berhasil terhubung!'
    });

    console.log(response.text);
}

main().catch((error) => {
    console.error('Gagal menghubungkan Gemini:', error.message);
});