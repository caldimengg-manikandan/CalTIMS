const express = require('express');
const router = express.Router();
const policyController = require('./policy.controller');

router.get('/', policyController.getPayrollPolicy);
router.put('/', policyController.updatePayrollPolicy);
router.post('/version', policyController.createNewPolicyVersion);
router.post('/preview', policyController.previewPolicyCalculation);

module.exports = router;
