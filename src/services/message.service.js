const { parseMessage, cleanTaskTitle  } = require('../ai/parser');
const taskService = require('./task.service');
const conversationService = require('./conversation.service');

const handleMessage = async (message, phone) => {
    const text = message.trim().toLowerCase();
    const context = conversationService.getContext(phone);
    
    if (/^status ai[.!?]*$/i.test(message.trim())) {
        conversationService.clearContext(phone);
        return require('../ai/ai-status').getStatus();
    }
    // Jawaban atas pertanyaan klarifikasi tindakan task.
    if (context?.type === 'ASK_TASK_ACTION') {
        if (/\b(batal|lupakan|gajadi|tidak jadi)\b/.test(text)) {
            conversationService.clearContext(phone);
            return 'Oke, dibatalkan.';
        }

        if (/\b(selesai|selesain|beres|kelar|done)\b/.test(text)) {
            const result = await taskService.completeTaskById(
                context.taskId,
                phone
            );

            conversationService.clearContext(phone);

            if (result.result === 'NOT_FOUND') {
                return 'Task tidak ditemukan atau sudah selesai.';
            }

            return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
        }

        if (/\b(pending|balikin|kembalikan)\b/.test(text)) {
            conversationService.clearContext(phone);

            return 'Untuk mengembalikan task ke pending, kirim daftar task yang sudah selesai lalu pilih nomornya.';
        }
    }

    // Memilih task dari daftar yang sebelumnya ditampilkan.
    const numberMatch = text.match(
        /^(?:(?:eh|terus|yang)\s+)?(?:task\s+)?(?:nomor\s*|no\s*)?(\d+)(?:\s+(?:udah\s+|sudah\s+)?(?:beres|selesai|kelar|done))?[.! ]*$/i
    );

    if (numberMatch && context?.taskIds?.length) {
        const number = Number(numberMatch[1]);
        const taskId = context.taskIds[number - 1];

        if (!taskId) {
            return `Nomor ${number} tidak ada di daftar tadi.`;
        }

        if (context.type === 'PENDING_TASK_LIST') {
            if (/\b(beres|selesai|kelar|done)\b/i.test(text)) {
                const result = await taskService.completeTaskById(
                    taskId,
                    phone
                );

                conversationService.clearContext(phone);

                if (result.result === 'NOT_FOUND') {
                    return 'Task tidak ditemukan atau sudah selesai.';
                }

                return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
            }

            conversationService.setContext(phone, {
                type: 'ASK_TASK_ACTION',
                taskId
            });

            return 'Mau menyelesaikan task ini atau melakukan tindakan lain? Balas "selesai" untuk menyelesaikannya.';
        }

        if (context.type === 'COMPLETED_TASK_LIST') {
            conversationService.clearContext(phone);
            return 'Untuk mengembalikan task ke pending, fitur pemilihan task selesai perlu ditambahkan.';
        }

        if (context.type === 'MATCHING_TASK_LIST') {
            const result = await taskService.completeTaskById(taskId, phone);
            conversationService.clearContext(phone);

            if (result.result === 'NOT_FOUND') {
                return 'Task tidak ditemukan atau sudah selesai.';
            }

            return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
        }
    }

    const parsed = await parseMessage(message);

    switch (parsed.intent) {
        case 'LIST_TASKS': {
            const tasks = await taskService.getAllTasks(phone);

            if (!tasks.length) {
                conversationService.clearContext(phone);
                return 'Belum ada task yang tercatat.';
            }

            conversationService.setContext(phone, {
                type: 'PENDING_TASK_LIST',
                taskIds: tasks.map(task => task.id)
            });

            return tasks
                .map((task, index) => `${index + 1}. ⏳ ${task.title}`)
                .join('\n');
        }

        case 'LIST_COMPLETED_TASKS': {
            const tasks = await taskService.getCompletedTasks(phone);

            if (!tasks.length) {
                conversationService.clearContext(phone);
                return 'Belum ada task yang selesai.';
            }

            conversationService.setContext(phone, {
                type: 'COMPLETED_TASK_LIST',
                taskIds: tasks.map(task => task.id)
            });

            return tasks
                .map((task, index) => `${index + 1}. ✅ ${task.title}`)
                .join('\n');
        }

        case 'CREATE_TASK': {
            if (!parsed.title?.trim()) {
                conversationService.setContext(phone, {
                    type: 'ASK_TASK_TITLE'
                });

                return 'Mau mencatat pekerjaan apa?';
            }

            // Rapikan judul task menggunakan AI.
            const cleanedTitle = await cleanTaskTitle(parsed.title);

            const task = await taskService.createTask(
                cleanedTitle,
                phone
            );

            conversationService.clearContext(phone);

            return `✅ Task berhasil ditambahkan: ${task.title}`;
        }

        case 'COMPLETE_TASK': {
            if (parsed.number !== null) {
                const result = await taskService.completeTaskByNumber(
                    parsed.number,
                    phone
                );

                if (result.result === 'NOT_FOUND') {
                    return `Task nomor ${parsed.number} tidak ditemukan di daftar pending.`;
                }

                conversationService.clearContext(phone);
                return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
            }

            if (parsed.query) {
                const result = await taskService.completeTaskByTitle(
                    parsed.query,
                    phone
                );

                if (result.result === 'NOT_FOUND') {
                    return `Aku belum menemukan task "${parsed.query}" yang masih pending.`;
                }

                if (result.result === 'MULTIPLE_MATCHES') {
                    conversationService.setContext(phone, {
                        type: 'MATCHING_TASK_LIST',
                        taskIds: result.tasks.map(task => task.id)
                    });

                    return result.tasks
                        .map((task, index) => `${index + 1}. ${task.title}`)
                        .join('\n') + '\n\nBalas nomor task yang mau diselesaikan.';
                }

                conversationService.clearContext(phone);
                return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
            }

            return 'Task mana yang mau diselesaikan? Sebutkan judulnya atau nomornya.';
        }

        case 'REOPEN_TASK': {
            if (parsed.number === null) {
                return 'Sebutkan nomor task completed yang ingin dikembalikan ke pending.';
            }

            const result = await taskService.reopenTaskByNumber(
                parsed.number,
                phone
            );

            if (result.result === 'NOT_FOUND') {
                return `Task completed nomor ${parsed.number} tidak ditemukan.`;
            }

            conversationService.clearContext(phone);
            return `↩️ Task "${result.task.title}" dikembalikan ke pending.`;
        }

        case 'UNCLEAR':
        default: {
            // Simpan konteks pertanyaan agar balasan berikutnya tidak langsung
            // dianggap sebagai perintah baru.
            conversationService.setContext(phone, {
                type: 'GENERAL_CLARIFICATION',
                lastMessage: message
            });

            return 'Aku belum yakin maksudmu. Mau menambahkan task, menyelesaikan task, mengembalikan task ke pending, atau melihat daftar task?';
        }
    }
};

module.exports = { handleMessage };