const prisma = require('../lib/prisma');
const whatsapp = require('../channels/whatsapp');

const REMINDER_INTERVAL_MS = 24 * 60 * 60 * 1000;
const MAX_REMINDERS = 3;
const CHECK_INTERVAL_MS = 60 * 1000;

let isRunning = false;

const processReminders = async () => {
    // Mencegah proses reminder berjalan tumpang tindih.
    if (isRunning) return;

    isRunning = true;

    try {
        const now = new Date();

        const tasks = await prisma.task.findMany({
            where: {
                status: 'PENDING',
                reminderCount: {
                    lt: MAX_REMINDERS
                },
                nextReminderAt: {
                    lte: now
                }
            },
            include: {
                user: true
            },
            orderBy: {
                nextReminderAt: 'asc'
            }
        });

        for (const task of tasks) {
            try {
                const message =
                    `🔔 Reminder Task\n\n` +
                    `Task "${task.title}" masih belum selesai.\n\n` +
                    `Balas "task ${task.title} beres" jika sudah selesai.`;

                await whatsapp.sendMessage(task.user.phone, message);

                const reminderCount = task.reminderCount + 1;

                await prisma.task.update({
                    where: {
                        id: task.id
                    },
                    data: {
                        reminderCount,
                        lastReminderAt: now,
                        nextReminderAt:
                            reminderCount < MAX_REMINDERS
                                ? new Date(now.getTime() + REMINDER_INTERVAL_MS)
                                : null
                    }
                });

                console.log(
                    `Reminder ${reminderCount}/${MAX_REMINDERS} terkirim untuk task ${task.id}.`
                );
            } catch (error) {
                console.error(
                    `Gagal mengirim reminder untuk task ${task.id}:`,
                    error.message
                );

                await prisma.task.update({
                    where: { id: task.id },
                    data: {
                        nextReminderAt: new Date(Date.now() + REMINDER_INTERVAL_MS)
                    }
                }).catch((updateError) => {
                    console.error('Gagal menjadwalkan ulang reminder:', updateError.message);
                });
            }
        }
    } catch (error) {
        console.error('Gagal menjalankan scheduler reminder:', error.message);
    } finally {
        isRunning = false;
    }
};

const startReminderScheduler = () => {
    console.log('Reminder scheduler aktif.');

    // Periksa task saat server mulai.
    processReminders();

    // Periksa kembali setiap menit.
    setInterval(processReminders, CHECK_INTERVAL_MS);
};

module.exports = {
    startReminderScheduler,
    processReminders
};