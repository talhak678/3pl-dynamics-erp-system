const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const teamController = require('../../controllers/teamController');

// Mounted in app.js behind adminAuth.isValidAuthToken and requireTenantOwner,
// in that order - requireTenantOwner reads req.admin, which the auth middleware
// is what populates.
//
// Kept off the app API (appRoutes/appApi.js) on purpose. That router is gated by
// requireModuleAccess, which maps a path's first segment to a module key and
// refuses it when the account lacks that module. Team management is not a module
// - it is a capability of owning the workspace - so putting it there would mean
// inventing a module key for it and then granting every owner that key, which
// would put "User Management" into the same checkbox list as Invoices and let an
// owner hand it to an employee.

router.route('/').get(catchErrors(teamController.listTeam));
router.route('/').post(catchErrors(teamController.createMember));

router.route('/:id').get(catchErrors(teamController.readMember));
router.route('/:id').patch(catchErrors(teamController.updateMember));
router.route('/:id').delete(catchErrors(teamController.removeMember));

module.exports = router;
