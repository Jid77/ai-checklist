const prisma = require('../lib/prisma');

const getAllTasks = async (phone) => {
    return await prisma.task.findMany({
        where: {
            user: {
                phone: phone
            },
            status: 'PENDING'
        },
        orderBy: {
            createdAt: 'desc'
        }
    });
};

const getCompletedTasks = async (phone) => {
    return await prisma.task.findMany({
        where: {
            user: {
                phone: phone
            },
            status: 'COMPLETED'
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });
};

const createTask = async (title, phone) => {
    const user = await prisma.user.upsert({
        where: {
            phone: phone
        },
        update: {},
        create: {
            phone: phone
        }
    });

    return await prisma.task.create({
        data: {
            title: title,
            userId: user.id
        }
    });
};

const completeTask = async (taskId, phone) => {
    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            user: {
                phone: phone
            }
        }
    });

    if (!task) {
        return null;
    }

    return await prisma.task.update({
        where: {
            id: task.id
        },
        data: {
            status: 'COMPLETED'
        }
    });
};

const completeTaskByTitle = async (title, phone) => {
    const keywords = title
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);

    const tasks = await prisma.task.findMany({
        where: {
            user: {
                phone: phone
            },
            status: 'PENDING',
            AND: keywords.map((keyword) => ({
                title: {
                    contains: keyword,
                    mode: 'insensitive'
                }
            }))
        }
    });

    if (tasks.length === 0) {
        return {
            result: 'NOT_FOUND'
        };
    }

    if (tasks.length > 1) {
        return {
            result: 'MULTIPLE_MATCHES',
            tasks
        };
    }

    const task = await prisma.task.update({
        where: {
            id: tasks[0].id
        },
        data: {
            status: 'COMPLETED'
        }
    });

    return {
        result: 'COMPLETED',
        task
    };
};

const completeTaskByNumber = async (number, phone) => {
    const tasks = await prisma.task.findMany({
        where: {
            user: {
                phone: phone
            },
            status: 'PENDING'
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const task = tasks[number - 1];

    if (!task) {
        return {
            result: 'NOT_FOUND'
        };
    }

    const completedTask = await prisma.task.update({
        where: {
            id: task.id
        },
        data: {
            status: 'COMPLETED'
        }
    });

    return {
        result: 'COMPLETED',
        task: completedTask
    };
};

const reopenTaskByNumber = async (number, phone) => {
    const tasks = await prisma.task.findMany({
        where: {
            user: {
                phone: phone
            },
            status: 'COMPLETED'
        },
        orderBy: {
            updatedAt: 'desc'
        }
    });

    const task = tasks[number - 1];

    if (!task) {
        return {
            result: 'NOT_FOUND'
        };
    }

    const updatedTask = await prisma.task.update({
        where: {
            id: task.id
        },
        data: {
            status: 'PENDING'
        }
    });

    return {
        result: 'REOPENED',
        task: updatedTask
    };
};


const completeTaskById = async (taskId, phone) => {
    // Pastikan task tersebut milik nomor WhatsApp yang meminta.
    const task = await prisma.task.findFirst({
        where: {
            id: taskId,
            user: { phone },
            status: 'PENDING'
        }
    });

    if (!task) {
        return { result: 'NOT_FOUND' };
    }

    const updatedTask = await prisma.task.update({
        where: { id: task.id },
        data: { status: 'COMPLETED' }
    });

    return {
        result: 'COMPLETED',
        task: updatedTask
    };
};

module.exports = {
    getAllTasks,
    getCompletedTasks,
    createTask,
    completeTask,
    completeTaskByTitle,
    completeTaskByNumber,
    reopenTaskByNumber,
    completeTaskById
};

module.exports = {
    getAllTasks,
    getCompletedTasks,
    createTask,
    completeTask,
    completeTaskByTitle,
    completeTaskByNumber,
    reopenTaskByNumber,
    completeTaskById
    
};
