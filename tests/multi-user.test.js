require('dotenv').config();

const taskService = require('../src/services/task.service');

async function main() {
    const userA = '6281111111111';
    const userB = '6282222222222';

    try {
        console.log('=== TEST MULTI-USER ===\n');

        // 1. Buat task untuk masing-masing pengguna
        await taskService.createTask('TEST A - Cek stok sparepart', userA);
        await taskService.createTask('TEST B - Cek mesin produksi', userB);

        console.log('1. Task berhasil dibuat untuk User A dan User B.');

        // 2. Ambil task masing-masing pengguna
        const tasksA = await taskService.getAllTasks(userA);
        const tasksB = await taskService.getAllTasks(userB);

        console.log('\nTask User A:');
        console.log(tasksA.map(task => task.title));

        console.log('\nTask User B:');
        console.log(tasksB.map(task => task.title));

        // 3. Pastikan task tidak bocor antar pengguna
        const aCanSeeB = tasksA.some(task =>
            task.title === 'TEST B - Cek mesin produksi'
        );

        const bCanSeeA = tasksB.some(task =>
            task.title === 'TEST A - Cek stok sparepart'
        );

        if (!aCanSeeB && !bCanSeeA) {
            console.log('\n✅ PASS: Task setiap pengguna terpisah.');
        } else {
            console.error('\n❌ FAIL: Ada task pengguna lain yang terlihat.');
            process.exitCode = 1;
        }

        // 4. Selesaikan task User A, lalu pastikan task User B tetap pending
        const taskA = tasksA.find(task =>
            task.title === 'TEST A - Cek stok sparepart'
        );

        if (!taskA) {
            throw new Error('Task pengujian User A tidak ditemukan.');
        }

        const result = await taskService.completeTaskById(taskA.id, userA);

        if (result.result !== 'COMPLETED') {
            throw new Error('Task User A gagal diselesaikan.');
        }

        const tasksBAfter = await taskService.getAllTasks(userB);

        const userBTaskStillPending = tasksBAfter.some(task =>
            task.title === 'TEST B - Cek mesin produksi'
        );

        if (userBTaskStillPending) {
            console.log('✅ PASS: Menyelesaikan task User A tidak memengaruhi User B.');
        } else {
            console.error('❌ FAIL: Task User B ikut terpengaruh.');
            process.exitCode = 1;
        }

        console.log('\n=== TEST SELESAI ===');
    } catch (error) {
        console.error('\n❌ TEST ERROR:', error.message);
        process.exitCode = 1;
    } finally {
        // Hapus hanya data pengujian ini agar tidak mengotori database.
        await taskService.deleteTestTasks?.([
            'TEST A - Cek stok sparepart',
            'TEST B - Cek mesin produksi'
        ]);

        process.exitCode = process.exitCode || 0;
    }
}

main();