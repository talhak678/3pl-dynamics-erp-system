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

// The one-off workspace backfill is deliberately NOT here. It is temporarily
// mounted without auth at /api/workspace/backfill so it can be triggered by
// opening a URL - see routes/coreRoutes/workspaceBackfillApi.js, which also
// says how to remove it. Do not re-add it to this router while that mount
// exists, or there will be two ways to run the same write.

module.exports = router;
