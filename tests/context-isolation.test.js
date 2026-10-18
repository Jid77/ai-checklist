require('dotenv').config();

const prisma = require('../src/lib/prisma');
const taskService = require('../src/services/task.service');
const conversationService = require('../src/services/conversation.service');
const { handleMessage } = require('../src/services/message.service');

const userA = '6281111111111';
const userB = '6282222222222';

const titleA = 'TEST CONTEXT A - Cek stok sparepart';
const titleB = 'TEST CONTEXT B - Cek mesin produksi';

async function main() {
    let exitCode = 0;

    try {
        console.log('=== TEST CONTEXT ISOLATION ===\n');

        // 1. Bersihkan sisa task pengujian sebelumnya.
        await prisma.task.deleteMany({
            where: {
                title: {
                    in: [titleA, titleB]
                }
            }
        });

        // 2. Buat task khusus untuk masing-masing pengguna.
        const taskA = await taskService.createTask(titleA, userA);
        const taskB = await taskService.createTask(titleB, userB);

        console.log('1. Task User A dan User B berhasil dibuat.');

        // 3. Simulasikan masing-masing pengguna sudah melihat daftar task.
        conversationService.setContext(userA, {
            type: 'PENDING_TASK_LIST',
            taskIds: [taskA.id]
        });

        conversationService.setContext(userB, {
            type: 'PENDING_TASK_LIST',
            taskIds: [taskB.id]
        });

        console.log('2. Konteks kedua pengguna berhasil dibuat.');

        // 4. Pastikan konteks awal tidak tertukar.
        const initialContextA = conversationService.getContext(userA);
        const initialContextB = conversationService.getContext(userB);

        if (
            initialContextA?.taskIds?.[0] === taskA.id &&
            initialContextB?.taskIds?.[0] === taskB.id
        ) {
            console.log('✅ PASS: Konteks awal setiap pengguna terpisah.');
        } else {
            console.error('❌ FAIL: Konteks awal pengguna tidak sesuai.');
            exitCode = 1;
        }

        // 5. User A menyelesaikan task nomor 1.
        console.log('\n3. User A mengirim: "Task nomor 1 udah beres"');

        const response = await handleMessage(
            'Task nomor 1 udah beres',
            userA
        );

        console.log('Balasan bot:', response);

        // 6. Periksa status task kedua pengguna.
        const updatedTaskA = await prisma.task.findUnique({
            where: {
                id: taskA.id
            }
        });

        const updatedTaskB = await prisma.task.findUnique({
            where: {
                id: taskB.id
            }
        });

        if (updatedTaskA?.status === 'COMPLETED') {
            console.log('✅ PASS: Task User A berhasil diselesaikan.');
        } else {
            console.error('❌ FAIL: Task User A tidak selesai.');
            exitCode = 1;
        }

        if (updatedTaskB?.status === 'PENDING') {
            console.log('✅ PASS: Task User B tetap pending.');
        } else {
            console.error('❌ FAIL: Task User B ikut berubah.');
            exitCode = 1;
        }

        // 7. Pastikan konteks User B tidak berubah.
        // Konteks User A boleh dihapus setelah task berhasil diselesaikan.
        const contextB = conversationService.getContext(userB);

        if (
            contextB?.type === 'PENDING_TASK_LIST' &&
            contextB?.taskIds?.[0] === taskB.id
        ) {
            console.log('✅ PASS: Konteks User B tetap tersimpan.');
        } else {
            console.error('❌ FAIL: Konteks User B hilang atau berubah.');
            exitCode = 1;
        }

        console.log('\n=== HASIL PENGUJIAN ===');

        if (exitCode === 0) {
            console.log('🎉 Semua pengujian berhasil.');
        } else {
            console.log('⚠️ Ada pengujian yang gagal.');
        }
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
        exitCode = 1;
    } finally {
        try {
            // 8. Hapus hanya task khusus pengujian.
            await prisma.task.deleteMany({
                where: {
                    title: {
                        in: [titleA, titleB]
                    }
                }
            });

            console.log('\nData task pengujian dibersihkan.');
        } catch (cleanupError) {
            console.error(
                'Gagal membersihkan task pengujian:',
                cleanupError.message
            );
            exitCode = 1;
        }

        // Bersihkan konteks pengujian.
        conversationService.clearContext(userA);
        conversationService.clearContext(userB);

        await prisma.$disconnect();
        process.exitCode = exitCode;
    }
}

main();