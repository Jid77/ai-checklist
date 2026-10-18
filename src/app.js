const express = require('express');
const taskRoutes = require('./routes/task.routes');
const webhookRoutes = require('./routes/webhook.routes');

const app = express();

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'AI Checklist API is running!',
        status: 'OK'
    });
});

app.use('/api/tasks', taskRoutes);
app.use('/webhook', webhookRoutes);

module.exports = app;