const express = require('express');
const router = express.Router();

const webhookController = require('../controllers/webhook.controller');

router.get('/', webhookController.verifyWebhook);
router.post('/', webhookController.receiveWebhook);

module.exports = router;