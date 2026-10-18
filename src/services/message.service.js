const { parseMessage } = require('../ai/parser');
const taskService = require('./task.service');
const conversationService = require('./conversation.service');

const handleMessage = async (message, phone) => {
    // 1. Periksa konteks percakapan sebelumnya.
    const context = conversationService.getContext(phone);

    const contextualMatch = message.match(
        /^\s*(?:(?:eh|terus)\s+)?(?:yang\s+)?(?:task\s+)?(?:nomor\s*|no\s*)?(\d+)\s*(?:(?:udah|sudah|dah)\s*)?(?:beres|selesai|kelar|done)\s*[.!]?\s*$/i
    );

    if (
        contextualMatch &&
        context?.type === 'PENDING_TASK_LIST'
    ) {
        const taskNumber = Number(contextualMatch[1]);
        const taskId = context.taskIds[taskNumber - 1];

        if (!taskId) {
            return `Nomor ${taskNumber} tidak ada di daftar task tadi.`;
        }

        const result = await taskService.completeTaskById(
            taskId,
            phone
        );

        if (result.result === 'NOT_FOUND') {
            return 'Task tersebut tidak ditemukan atau sudah selesai sebelumnya.';
        }

        conversationService.clearContext(phone);

        return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
    }

    // 2. Jalankan parser untuk pesan yang bukan perintah kontekstual.
    const parsed = await parseMessage(message);

    switch (parsed.intent) {
        // Menampilkan task yang belum selesai.
        case 'LIST_TASKS': {
            const tasks = await taskService.getAllTasks(phone);

            if (tasks.length === 0) {
                conversationService.clearContext(phone);
                return 'Belum ada task yang tercatat.';
            }

            conversationService.setContext(phone, {
                type: 'PENDING_TASK_LIST',
                taskIds: tasks.map((task) => task.id)
            });

            return tasks
                .map((task, index) => `${index + 1}. ⏳ ${task.title}`)
                .join('\n');
        }

        // Menampilkan task yang sudah selesai.
        case 'LIST_COMPLETED_TASKS': {
            const tasks = await taskService.getCompletedTasks(phone);

            if (tasks.length === 0) {
                conversationService.clearContext(phone);
                return 'Belum ada task yang selesai.';
            }

            conversationService.setContext(phone, {
                type: 'COMPLETED_TASK_LIST',
                taskIds: tasks.map((task) => task.id)
            });

            return tasks
                .map((task, index) => `${index + 1}. ✅ ${task.title}`)
                .join('\n');
        }

        // Menambahkan task baru.
        case 'CREATE_TASK': {
            if (!parsed.title?.trim()) {
                return 'Judul task belum jelas. Coba tulis ulang, ya.';
            }

            const task = await taskService.createTask(
                parsed.title.trim(),
                phone
            );

            conversationService.clearContext(phone);

            return `Task berhasil ditambahkan: ${task.title}`;
        }

        // Mengembalikan task completed ke pending.
        case 'REOPEN_TASK': {
            const numberMatch = message.match(
                /\b(?:task\s+)?(?:completed\s+)?(?:nomor\s*|no\s*)?(\d+)\s+(?:balikin|kembalikan|ubah|jadiin|jadi|batalin)\s+(?:ke\s+)?pending\b/i
            );

            const taskNumber = parsed.number ?? (
                numberMatch ? Number(numberMatch[1]) : null
            );

            if (taskNumber === null) {
                return 'Sebutkan nomor task completed yang ingin dikembalikan ke pending.';
            }

            const result = await taskService.reopenTaskByNumber(
                taskNumber,
                phone
            );

            if (result.result === 'NOT_FOUND') {
                return `Task completed nomor ${taskNumber} tidak ditemukan.`;
            }

            conversationService.clearContext(phone);

            return `↩️ Task "${result.task.title}" dikembalikan ke pending.`;
        }

        // Menyelesaikan task berdasarkan nomor atau judul.
        case 'COMPLETE_TASK': {
            const numberMatch = message.match(
                /\b(?:task\s*)?(?:nomor\s*|no\s*)?(\d+)\s*(?:(?:udah|sudah|dah)\s*)?(?:beres|selesai|kelar|done)\b/i
            );

            const taskNumber = parsed.number ?? (
                numberMatch ? Number(numberMatch[1]) : null
            );

            if (taskNumber !== null) {
                const result = await taskService.completeTaskByNumber(
                    taskNumber,
                    phone
                );

                if (result.result === 'NOT_FOUND') {
                    return `Task nomor ${taskNumber} tidak ditemukan di daftar task pending kamu.`;
                }

                conversationService.clearContext(phone);

                return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
            }

            const query = (parsed.query || '')
                .replace(
                    /\b(task|yang|udah|sudah|dah|beres|selesai|kelar|done|nomor|no)\b/gi,
                    ''
                )
                .replace(/\s+/g, ' ')
                .trim();

            if (!query) {
                return 'Sebutkan judul task yang ingin diselesaikan, ya.';
            }

            const result = await taskService.completeTaskByTitle(
                query,
                phone
            );

            if (result.result === 'NOT_FOUND') {
                return `Aku belum menemukan task "${query}" yang masih pending.`;
            }

            if (result.result === 'MULTIPLE_MATCHES') {
                conversationService.setContext(phone, {
                    type: 'MATCHING_TASK_LIST',
                    taskIds: result.tasks.map((task) => task.id)
                });

                const choices = result.tasks
                    .map((task, index) => `${index + 1}. ${task.title}`)
                    .join('\n');

                return `Ada beberapa task yang cocok. Pilih salah satu:\n${choices}`;
            }

            conversationService.clearContext(phone);

            return `✅ Task "${result.task.title}" berhasil diselesaikan!`;
        }

        // Pesan tidak dipahami.
        case 'UNCLEAR':
        default:
            return 'Aku belum yakin maksudmu. Mau menambahkan task, menyelesaikan task, mengembalikan task ke pending, atau melihat daftar task?';
    }
};

module.exports = {
    handleMessage
};