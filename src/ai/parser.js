require('dotenv').config();

const UNCLEAR = {
    intent: 'UNCLEAR',
    title: null,
    query: null,
    number: null
};

const getAI = () => {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error('OPENROUTER_API_KEY belum diatur di .env');
    }

    return {
        apiKey: process.env.OPENROUTER_API_KEY,
        model:
            process.env.OPENROUTER_MODEL ||
            'minimax/minimax-m3.1-flash:free'
    };
};

// Normalisasi bahasa chat Indonesia.
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
        .replace(/\b(tolong|pls|please)\b/g, ' ')
        .replace(/\b(catetin|catet|catatkan|catat)\b/g, 'catat')
        .replace(/\b(tambahin|tambahkan|tambah)\b/g, 'tambah')
        .replace(/\b(ingetin|ingatkan|remind)\b/g, 'ingatkan')
        .replace(/\b(liatin|tampilin|tampilkan|lihatkan)\b/g, 'lihat')
        .replace(/\b(kerjaanku|pekerjaanku)\b/g, 'task')
        .replace(/\s+/g, ' ')
        .trim();
};

const result = (intent, extra = {}) => ({
    intent,
    title: extra.title ?? null,
    query: extra.query ?? null,
    number: extra.number ?? null
});

// Parser lokal: tidak membutuhkan API.
const parseLocally = (message) => {
    const text = normalizeMessage(message);

    if (!text) return UNCLEAR;

    // Cegah tindakan yang secara eksplisit ditolak.
    if (
        /\b(jangan|belum|bukan|tidak|gak usah|batal|batalkan|urungkan)\b/.test(text) &&
        /\b(beres|selesai|kelar|done|selesaikan|pending)\b/.test(text) &&
        !/\bjangan lupa\b/.test(text)
    ) {
        return UNCLEAR;
    }

    // 1. Membuat task.
    const createMatch = text.match(
        /^(?:(?:jangan lupa)\s+)?(?:catat|tambah|buat|ingatkan)\s+(?:(?:task|tugas|pekerjaan)\s+)?(?:gue\s+)?(.+)$/
    );

    if (createMatch) {
        const title = createMatch[1]
            .replace(/^(?:task|tugas|pekerjaan)\s+/, '')
            .trim();

        if (title && !/^(task|tugas|pekerjaan|baru)$/.test(title)) {
            return result('CREATE_TASK', { title });
        }

        return UNCLEAR;
    }

    const explicitTaskMatch = text.match(
        /^(?:task|tugas|pekerjaan)\s*[:=-]\s*(.+)$/
    );

    if (explicitTaskMatch?.[1]?.trim()) {
        return result('CREATE_TASK', {
            title: explicitTaskMatch[1].trim()
        });
    }

    // 2. Mengembalikan task ke pending.
    if (
        /\b(balikin|kembalikan|ubah|jadiin|jadikan|batalin)\b/.test(text) &&
        /\b(pending|belum selesai|belum beres)\b/.test(text)
    ) {
        const numberMatch = text.match(
            /\b(?:task\s+)?(?:completed\s+)?(?:nomor\s*|no\s*)?(\d+)\b/
        );

        const titleMatch = text.match(
            /\b(?:task\s+)?(.+?)\s+(?:balikin|kembalikan|ubah|jadiin|jadikan|batalin)\s+(?:ke\s+)?(?:status\s+)?(?:pending|belum selesai|belum beres)\b/
        );

        return result('REOPEN_TASK', {
            number: numberMatch ? Number(numberMatch[1]) : null,
            query: numberMatch ? null : titleMatch?.[1]?.trim() || null
        });
    }

    // 3. Melihat daftar task selesai.
    const asksForList =
        /\b(lihat|lihatin|cek|daftar|list|show|spill|tampilkan|tampilin|apa saja|apa aja|mana|riwayat)\b/.test(text);

    const mentionsCompleted =
        /\b(completed|selesai|beres|kelar|done|riwayat)\b/.test(text);

    if (
        asksForList &&
        mentionsCompleted &&
        !/\b(?:task|tugas)\s+.+\s+(?:sudah\s+)?(?:beres|selesai|kelar|done)\b/.test(text)
    ) {
        return result('LIST_COMPLETED_TASKS');
    }

    // 4. Melihat daftar task pending.
    if (
        /\b(task|tugas|kerjaan|pekerjaan)\b/.test(text) &&
        /\b(lihat|cek|daftar|list|show|spill|apa|mana|punya|tampilkan|tampilin|sekarang)\b/.test(text)
    ) {
        return result('LIST_TASKS');
    }

    if (
        /\b(task|tugas|kerjaan|pekerjaan)\b/.test(text) &&
        /\b(apa saja|apa aja|apaan|punya)\b/.test(text)
    ) {
        return result('LIST_TASKS');
    }

    // 5. Menyelesaikan task berdasarkan nomor.
    const numberCompleteMatch = text.match(
        /^(?:(?:eh|terus)\s+)?(?:yang\s+)?(?:task\s+)?(?:nomor\s*|no\s*)?(\d+)\s*(?:(?:sudah|beres|selesai|kelar)\s*)?(?:sudah\s*)?(?:beres|selesai|kelar|done)$/
    );

    if (numberCompleteMatch) {
        return result('COMPLETE_TASK', {
            number: Number(numberCompleteMatch[1])
        });
    }

    // 6. Menyelesaikan task berdasarkan judul.
    const completeMatch = text.match(
        /^(?:yang\s+)?(?:task\s+|tugas\s+)?(.+?)\s+(?:sudah\s+)?(?:beres|selesai|kelar|done)$/
    );

    if (completeMatch) {
        const query = completeMatch[1]
            .replace(/^(?:task|tugas)\s+/, '')
            .trim();

        if (
            query &&
            !/^\d+$/.test(query) &&
            !/\b(apa saja|apa aja|mana|daftar|list|riwayat)\b/.test(query)
        ) {
            return result('COMPLETE_TASK', { query });
        }
    }

    return null;
};

// Parser AI menggunakan OpenRouter.
const parseWithOpenRouter = async (message) => {
    const ai = getAI();

    const prompt = `
Kamu adalah parser pesan untuk aplikasi checklist berbahasa Indonesia.

Kembalikan JSON valid saja dengan struktur:
{
  "intent": "CREATE_TASK | LIST_TASKS | LIST_COMPLETED_TASKS | COMPLETE_TASK | REOPEN_TASK | UNCLEAR",
  "title": null,
  "query": null,
  "number": null
}

Aturan:
- CREATE_TASK: pengguna jelas meminta mencatat pekerjaan atau pengingat.
- LIST_TASKS: melihat task yang masih pending.
- LIST_COMPLETED_TASKS: melihat task yang selesai.
- COMPLETE_TASK: menyelesaikan task tertentu.
- REOPEN_TASK: mengembalikan task selesai ke pending.
- UNCLEAR: maksud tidak jelas atau bertentangan.
- Untuk CREATE_TASK, title berisi pekerjaan yang ingin dicatat.
- Untuk COMPLETE_TASK atau REOPEN_TASK, query berisi judul jika disebut.
- Isi number jika nomor task disebut secara eksplisit.
- Jangan mengarang judul, nomor, atau konteks.
- Jangan menganggap semua pesan sebagai task baru.
- Pesan seperti "jangan selesaikan task 2" harus menghasilkan UNCLEAR.
- Pahami singkatan dan bahasa chat informal Indonesia.
- Field yang tidak relevan harus null.

Contoh:
"besok cek stok sparepart" =>
{"intent":"CREATE_TASK","title":"Besok cek stok sparepart","query":null,"number":null}

"catetin beli bearing" =>
{"intent":"CREATE_TASK","title":"Beli bearing","query":null,"number":null}

"task 2 beres" =>
{"intent":"COMPLETE_TASK","title":null,"query":null,"number":2}

"task cek stok udah kelar" =>
{"intent":"COMPLETE_TASK","title":null,"query":"cek stok","number":null}

"task gue apa aja?" =>
{"intent":"LIST_TASKS","title":null,"query":null,"number":null}

"apa aja yang udah selesai?" =>
{"intent":"LIST_COMPLETED_TASKS","title":null,"query":null,"number":null}

"task completed nomor 2 balikin ke pending" =>
{"intent":"REOPEN_TASK","title":null,"query":null,"number":2}

"halo, lagi apa?" =>
{"intent":"UNCLEAR","title":null,"query":null,"number":null}

Pesan pengguna:
${JSON.stringify(message)}
`;

    const response = await fetch(
        'https://openrouter.ai/api/v1/chat/completions',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${ai.apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: ai.model,
                messages: [
                    {
                        role: 'system',
                        content:
                            'Kamu adalah parser intent aplikasi checklist. Balas hanya dengan JSON valid tanpa markdown.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0,
                max_tokens: 800,
                reasoning: {
                    effort: 'minimal'
                }
            })
        }
    );

    if (!response.ok) {
        // Jangan mencetak API key atau header rahasia ke log.
        throw new Error(`OpenRouter API mengembalikan status HTTP ${response.status}`);
    }

    const data = await response.json();

    // console.log('OpenRouter response:', JSON.stringify(data, null, 2));

    const content = data.choices?.[0]?.message?.content;

    if (typeof content !== 'string' || !content.trim()) {
        throw new Error('Respons OpenRouter kosong atau tidak valid.');
    }

    const jsonText = content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

    const parsed = JSON.parse(jsonText);

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

    return result(parsed.intent, {
        title: typeof parsed.title === 'string' ? parsed.title : null,
        query: typeof parsed.query === 'string' ? parsed.query : null,
        number:
            Number.isInteger(parsed.number) && parsed.number > 0
                ? parsed.number
                : null
    });
};

// Fungsi utama parser.
const parseMessage = async (message) => {
    if (typeof message !== 'string' || !message.trim()) {
        return UNCLEAR;
    }

    // Utamakan parser lokal agar perintah umum tidak memakai kuota AI.
    const localResult = parseLocally(message);

    if (localResult) {
        return localResult;
    }

    // Jika parser lokal tidak mengenali pesan, coba OpenRouter.
    try {
        return await parseWithOpenRouter(message);
    } catch (error) {
        console.error(
            'OpenRouter gagal, menggunakan fallback lokal:',
            error.message
        );

        return UNCLEAR;
    }
};

// Merapikan judul task menggunakan OpenRouter.
const cleanTaskTitle = async (title) => {
    if (!title || typeof title !== 'string') {
        return title;
    }

    try {
        const ai = getAI();

        const response = await fetch(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${ai.apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: ai.model,
                    messages: [
                        {
                            role: 'system',
                            content: `
Kamu bertugas merapikan judul task untuk aplikasi checklist berbahasa Indonesia.

Aturan:
- Ubah bahasa informal menjadi bahasa Indonesia yang rapi dan natural.
- Gunakan judul singkat, jelas, dan mudah dipahami.
- Gunakan kata kerja yang sesuai, seperti Membuat, Memeriksa, Menyelesaikan, atau Membeli.
- Gunakan Title Case yang natural.
- Pertahankan maksud asli, nama orang, singkatan teknis, dan informasi waktu.
- Jangan menambahkan informasi yang tidak disebutkan.
- Jangan memberi penjelasan atau tanda kutip.
- Kembalikan judul task saja.

Contoh:
"gw perlu nyelesain bab 3 TA" → Menyelesaikan Bab 3 Tugas Akhir
"besok cek stok sparepart ahu" → Cek Stok Sparepart AHU Besok
"ntar beli bearing buat pompa" → Membeli Bearing untuk Pompa
"gw harus bikin report mingguan" → Membuat Laporan Mingguan
"jgn lupa follow up bu mega soal oa" → Follow Up OA ke Bu Mega
"hari ini cek panel listrik" → Memeriksa Panel Listrik Hari Ini
`
                        },
                        {
                            role: 'user',
                            content: title
                        }
                    ],
                    temperature: 0.2,
                    max_tokens: 200,
                    reasoning: {
                        effort: 'minimal'
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const cleanedTitle = data.choices?.[0]?.message?.content
            ?.trim()
            .replace(/^["'`]+|["'`]+$/g, '');

        if (!cleanedTitle) {
            throw new Error('Judul hasil AI kosong.');
        }

        return cleanedTitle;
    } catch (error) {
        console.error('Gagal merapikan judul task:', error.message);

        // Jika AI gagal, tetap gunakan judul asli.
        return title.trim();
    }
};

module.exports = {
    parseMessage,
    normalizeMessage,
    parseLocally,
    cleanTaskTitle
};