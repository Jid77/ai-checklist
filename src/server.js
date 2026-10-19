require('dotenv').config();

const app = require('./app');
const { startReminderScheduler } = require('./services/reminder.service');


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server berjalan di http://localhost:${PORT}`);
    startReminderScheduler();

});