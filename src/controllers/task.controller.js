const taskService = require('../services/task.service');

const getTasks = async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone || typeof phone !== 'string' || !phone.trim()) {
            return res.status(400).json({
                message: 'Parameter phone wajib diisi'
            });
        }

        const tasks = await taskService.getAllTasks(phone.trim());

        res.json({
            message: 'Berhasil mengambil daftar task',
            data: tasks
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Gagal mengambil daftar task'
        });
    }
};

const createTask = async (req, res) => {
    try {
        const { title, phone } = req.body;

        if (!title || typeof title !== 'string' || !title.trim()) {
            return res.status(400).json({
                message: 'Judul task wajib diisi'
            });
        }

        if (!phone || typeof phone !== 'string' || !phone.trim()) {
            return res.status(400).json({
                message: 'Nomor telepon wajib diisi'
            });
        }

        const task = await taskService.createTask(
            title.trim(),
            phone.trim()
        );

        res.status(201).json({
            message: 'Task berhasil dibuat',
            data: task
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Gagal membuat task'
        });
    }
};

const completeTask = async (req, res) => {
    try {
        const { id } = req.params;
        const { phone } = req.body;

        if (!phone || typeof phone !== 'string' || !phone.trim()) {
            return res.status(400).json({
                message: 'Nomor telepon wajib diisi'
            });
        }

        const task = await taskService.completeTask(
            id,
            phone.trim()
        );

        if (!task) {
            return res.status(404).json({
                message: 'Task tidak ditemukan'
            });
        }

        res.json({
            message: 'Task berhasil diselesaikan',
            data: task
        });
    } catch (error) {
        console.error(error);

        res.status(500).json({
            message: 'Gagal menyelesaikan task'
        });
    }
};

module.exports = {
    getTasks,
    createTask,
    completeTask
};