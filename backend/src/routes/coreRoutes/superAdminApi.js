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

// Workspaces are the prerequisite for a tenant account - see createUser, which
// refuses to provision one without them - so a super admin needs this before
// the user routes above are usable at all.
router.route('/workspaces').get(catchErrors(superAdminController.listWorkspaces));
router.route('/workspaces').post(catchErrors(superAdminController.createWorkspace));

router
  .route('/workspaces/:id/status')
  .patch(catchErrors(superAdminController.updateWorkspaceStatus));

module.exports = router;
