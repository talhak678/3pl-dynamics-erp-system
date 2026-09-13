const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const superAdminController = require('../../controllers/coreControllers/superAdminController');

// Mounted in app.js behind adminAuth.isValidAuthToken and requireSuperAdmin,
// in that order — requireSuperAdmin reads req.admin, which the auth middleware
// is what populates.

router.route('/users').get(catchErrors(superAdminController.listUsers));
router.route('/users').post(catchErrors(superAdminController.createUser));

router.route('/users/:id/status').patch(catchErrors(superAdminController.toggleUserStatus));
router
  .route('/users/:id/permissions')
  .patch(catchErrors(superAdminController.updateUserPermissions));

module.exports = router;
