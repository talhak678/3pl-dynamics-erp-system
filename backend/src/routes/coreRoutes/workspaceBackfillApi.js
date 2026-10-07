const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const superAdminController = require('../../controllers/coreControllers/superAdminController');

/**
 * TEMPORARY, DELIBERATELY UNAUTHENTICATED. DELETE THIS FILE AND ITS MOUNT.
 *
 * This router exists for exactly one reason: the production database sits behind
 * an IP allow-list that admits only the deployed environment, so the one-off
 * workspace backfill has to be triggered from a deployed URL. It is mounted
 * without adminAuth.isValidAuthToken and without requireSuperAdmin so it can be
 * opened directly in a browser.
 *
 * That combination is not something to leave in place. It is a public,
 * unauthenticated write endpoint on production: anyone who knows the path can
 * run it, and a crawler or link-preview bot that happens to fetch the URL will
 * run it too. The operation itself is idempotent and touches only accounts that
 * have no workspace, which is why this is tolerable for a single deploy - not
 * why it is safe to keep.
 *
 * To remove it:
 *   1. delete this file
 *   2. delete its `app.use('/api/workspace', ...)` line in src/app.js
 *   3. delete backfillLegacyWorkspaces.js and its entry in the
 *      superAdminController index
 *   4. redeploy - the route lives until the deployment is replaced
 *
 * The generic `/api` routers below it in app.js are guarded, and this mount is
 * placed ahead of them so the path resolves here first. Removing this file
 * without removing the mount leaves a broken import, so do both together.
 */

// GET rather than POST only because the whole point is to paste it into a
// browser. It writes, so this violates the usual rule deliberately - see above.
router.route('/backfill').get(catchErrors(superAdminController.backfillLegacyWorkspaces));

module.exports = router;
