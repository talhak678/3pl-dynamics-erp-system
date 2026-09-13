const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const adminAuth = require('../../controllers/coreControllers/adminAuth');
const setupDemos = require('../../controllers/coreControllers/setupDemos');
const migrateOwnership = require('../../controllers/coreControllers/migrateOwnership');

router.route('/setup-demos').get(catchErrors(setupDemos));

// One-time multi-tenancy backfill, protected by MIGRATION_SECRET.
// Remove this route once the migration has been verified.
router.route('/migrate-ownership').get(catchErrors(migrateOwnership));

router.route('/login').post(catchErrors(adminAuth.login));

router.route('/forgetpassword').post(catchErrors(adminAuth.forgetPassword));
router.route('/resetpassword').post(catchErrors(adminAuth.resetPassword));

router.route('/logout').post(adminAuth.isValidAuthToken, catchErrors(adminAuth.logout));

module.exports = router;
