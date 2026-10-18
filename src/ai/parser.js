require('dotenv').config();
let aiClientPromise;

const getAI = async () => {
    if (!aiClientPromise) {
        aiClientPromise = import('@google/genai').then(({ GoogleGenAI }) => {
            if (!process.env.GEMINI_API_KEY) {
                throw new Error('GEMINI_API_KEY belum diatur di .env');
            }

            return new GoogleGenAI({
                apiKey: process.env.GEMINI_API_KEY
            });
        }).catch((error) => {
            aiClientPromise = null;
            throw error;
        });
    }

    return aiClientPromise;
};

// Menyamakan singkatan dan variasi bahasa chat.
const normalizeMessage = (message) => {
    return message
        .toLowerCase()
        .trim()
        .replace(/[!?.,]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\b(gw|gua)\b/g, 'gue')
        .replace(/\b(lo)\b/g, 'lu')
        .replace(/\b(udh|udah|dah)\b/g, 'sudah')
        .replace(/\b(blm|belom)\b/g, 'belum')
        .replace(/\b(yg)\b/g, 'yang')
        .replace(/\b(gmn)\b/g, 'gimana')
        .replace(/\b(knp)\b/g, 'kenapa')
        .replace(/\b(ga|gak|ngga|nggak)\b/g, 'tidak')
        .replace(/\b(krn)\b/g, 'karena')
        .replace(/\b(sm)\b/g, 'sama')
        .replace(/\b(ntr|ntar)\b/g, 'nanti')
        .replace(/\b(dgn)\b/g, 'dengan')
        .replace(/\b(hrs)\b/g, 'harus')
        .replace(/\b(bsk)\b/g, 'besok')
        .replace(/\b(tambahin|tambah)\b/g, 'tambah')
        .replace(/\b(catetin|catet|catat)\b/g, 'catat')
        .replace(/\s+/g, ' ')
        .trim();
};

// Parser lokal untuk perintah yang sudah jelas.
const parseLocally = (message) => {
    const text = normalizeMessage(message);

    // Jangan menjalankan perintah yang mengandung penolakan eksplisit.
    if (
        /\b(jangan|belum|bukan|tidak|gak usah|batal)\b/.test(text) &&
        /\b(beres|selesai|kelar|done|selesaikan|pending)\b/.test(text)
    ) {
        return {
            intent: 'UNCLEAR',
            title: null,
            query: null,
            number: null
        };
    }

    // Perintah melihat task yang sudah selesai.
    if (
        /\b(task|tugas|kerjaan|riwayat|yang)\b/.test(text) &&
        /\b(completed|selesai|beres|kelar|riwayat|done)\b/.test(text) &&
        /\b(lihat|liatin|tampilkan|tampilin|cek|list|show|apa|mana|daftar|riwayat)\b/.test(text)
    ) {
        return {
            intent: 'LIST_COMPLETED_TASKS',
            title: null,
            query: null,
            number: null
        };
    }

    // Perintah melihat daftar task pending.
    if (
        /\b(lihat|liatin|tampilkan|tampilin|daftar|list|show|spill)\b/.test(text) &&
        /\b(task|tugas|kerjaan|kerjaanku)\b/.test(text)
    ) {
        return {
            intent: 'LIST_TASKS',
            title: null,
            query: null,
            number: null
        };
    }

    // Variasi perintah melihat task, misalnya:
    // "task gue apa aja?" atau "gue punya kerjaan apa?"
    if (
        /\b(task|tugas|kerjaan|kerjaanku)\b/.test(text) &&
        /\b(apa aja|apaan|punya|sekarang)\b/.test(text)
    ) {
        return {
            intent: 'LIST_TASKS',
            title: null,
            query: null,
            number: null
        };
    }

    // Mengembalikan task completed ke pending.
    if (
        /\b(balikin|kembalikan|ubah|jadiin|jadi|batalin)\b/.test(text) &&
        /\b(pending|belum selesai)\b/.test(text)
    ) {
        const numberMatch = text.match(
            /\b(?:task\s+)?(?:completed\s+)?(?:nomor\s*|no\s*)?(\d+)\b/
        );

        const titleMatch = text.match(
            /\b(?:task\s+)?(.+?)\s+(?:balikin|kembalikan|ubah|jadiin|jadi|batalin)\s+(?:ke\s+)?pending\b/
        );

        return {
            intent: 'REOPEN_TASK',
            title: null,
            query: numberMatch ? null : titleMatch?.[1]?.trim() || null,
            number: numberMatch ? Number(numberMatch[1]) : null
        };
    }

    // Menyelesaikan task berdasarkan nomor.
    const numberMatch = text.match(
        /\b(?:task\s*)?(?:nomor\s*|no\s*)?(\d+)\s*(?:sudah\s*)?(?:beres|selesai|kelar|done)\b/
    );

    if (numberMatch) {
        return {
            intent: 'COMPLETE_TASK',
            title: null,
            query: null,
            number: Number(numberMatch[1])
        };
    }

    // Variasi: "task cek stok udah beres".
    const completeMatch = text.match(
        /^(?:task\s+)?(.+?)\s+(?:sudah\s+)?(?:beres|selesai|kelar|done)$/
    );

    if (completeMatch) {
        const query = completeMatch[1]
            .replace(/^(task|tugas)\s+/, '')
            .trim();

        if (query && !/^\d+$/.test(query)) {
            return {
                intent: 'COMPLETE_TASK',
                title: null,
                query,
                number: null
            };
        }
    }

    // Pesan lain akan diproses oleh Gemini.
    return null;
};

const parseMessage = async (message) => {
    if (typeof message !== 'string' || !message.trim()) {
        return {
            intent: 'UNCLEAR',
            title: null,
            query: null,
            number: null
        };
    }

    const localResult = parseLocally(message);

    if (localResult) {
        return localResult;
    }

    const ai = await getAI();

    const prompt = `
Kamu adalah parser pesan untuk aplikasi checklist berbahasa Indonesia.

Pahami bahasa chat informal, singkatan, typo ringan, dan campuran bahasa
Indonesia-Inggris. Contoh: gw, gue, gua, lu, lo, udh, dah, blm, yg,
gmn, knp, ntar, bsk, kelar, beres, done, catetin, tambahin, liat.

Tentukan maksud pesan pengguna dan kembalikan JSON saja:
{
  "intent": "CREATE_TASK | LIST_TASKS | LIST_COMPLETED_TASKS | COMPLETE_TASK | REOPEN_TASK | UNCLEAR",
  "title": null,
  "query": null,
  "number": null
}

Aturan:
- CREATE_TASK: pengguna ingin mencatat pekerjaan atau pengingat baru.
- LIST_TASKS: pengguna ingin melihat task yang belum selesai.
- LIST_COMPLETED_TASKS: pengguna ingin melihat task yang selesai.
- COMPLETE_TASK: pengguna secara jelas ingin menandai task selesai.
- REOPEN_TASK: pengguna ingin mengembalikan task ke pending.
- UNCLEAR: maksud tidak jelas, saling bertentangan, atau membutuhkan konteks
  percakapan yang belum tersedia.
- Untuk CREATE_TASK, isi title dengan isi pekerjaan yang perlu dicatat.
- Untuk COMPLETE_TASK atau REOPEN_TASK, isi query jika judul task disebut.
- Isi number jika nomor task disebut secara eksplisit.
- Field yang tidak relevan harus null.
- Jangan mengarang judul, nomor, atau konteks yang tidak tersedia.
- Kalimat negatif seperti "jangan diselesaikan dulu" bukan COMPLETE_TASK.
- "Yang tadi" atau "yang pertama" tanpa konteks yang cukup harus UNCLEAR.
- Jangan menganggap semua pesan yang tidak dikenal sebagai task baru.
- Balas dengan JSON valid saja tanpa Markdown.

Contoh:
Pesan: "besok cek stok sparepart"
Output: {"intent":"CREATE_TASK","title":"Besok cek stok sparepart","query":null,"number":null}

Pesan: "task cek stok udh kelar"
Output: {"intent":"COMPLETE_TASK","title":null,"query":"cek stok","number":null}

Pesan: "tampilin task gw dong"
Output: {"intent":"LIST_TASKS","title":null,"query":null,"number":null}

Pesan: "apa aja yang udh selesai?"
Output: {"intent":"LIST_COMPLETED_TASKS","title":null,"query":null,"number":null}

Pesan: "task completed nomor 2 balikin ke pending"
Output: {"intent":"REOPEN_TASK","title":null,"query":null,"number":2}

Pesan: "eh jangan diselesaiin dulu"
Output: {"intent":"UNCLEAR","title":null,"query":null,"number":null}

Pesan pengguna:
${JSON.stringify(message)}
`;

    let response;

    try {
        response = await ai.models.generateContent({
            model: 'gemini-3.8-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
    } catch (error) {
        console.error('Gemini API error:', error.message);
        throw new Error(
            'Layanan AI sedang bermasalah. Coba ulangi beberapa saat lagi.'
        );
    }

    let parsed;

    try {
        parsed = JSON.parse(response.text);
    } catch {
        throw new Error('Respons AI tidak valid. Coba ulangi pesan.');
    }

    const validIntents = [
        'CREATE_TASK',
        'LIST_TASKS',
        'LIST_COMPLETED_TASKS',
        'COMPLETE_TASK',
        'REOPEN_TASK',
        'UNCLEAR'
    ];

    if (!validIntents.includes(parsed.intent)) {
        throw new Error('AI mengembalikan intent yang tidak valid.');
    }

    return {
        intent: parsed.intent,
        title: typeof parsed.title === 'string' ? parsed.title : null,
        query: typeof parsed.query === 'string' ? parsed.query : null,
        number:
            Number.isInteger(parsed.number) && parsed.number > 0
                ? parsed.number
                : null
    };
};

module.exports = {
    parseMessage
};