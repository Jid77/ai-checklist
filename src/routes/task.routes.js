const express = require('express');
const router = express.Router();

const taskController = require('../controllers/task.controller');

router.get('/', taskController.getTasks);
router.post('/', taskController.createTask);
router.patch('/:id/complete', taskController.completeTask);

module.exports = router;