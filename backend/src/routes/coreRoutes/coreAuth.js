const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const adminAuth = require('../../controllers/coreControllers/adminAuth');

router.route('/login').post(catchErrors(adminAuth.login));

router.route('/forgetpassword').post(catchErrors(adminAuth.forgetPassword));
router.route('/resetpassword').post(catchErrors(adminAuth.resetPassword));

router.route('/logout').post(adminAuth.isValidAuthToken, catchErrors(adminAuth.logout));

// The signed-in account re-reading its own profile, so a permission change made
// by its Customer Admin takes effect on a page refresh rather than requiring a
// sign-out. Guarded like logout rather than like login: it describes an
// existing session, so there has to be one, and isValidAuthToken is what makes
// the account it describes the caller's own.
//
// Mounted here, on the router that is not behind a blanket auth guard, so the
// guard is applied to this route alone. The alternative - adding it to coreApi
// or appApi, whose routers are mounted with isValidAuthToken already applied -
// would work but would place an auth endpoint under the module-access guard
// those routers also carry.
router.route('/auth/me').get(adminAuth.isValidAuthToken, catchErrors(adminAuth.me));

module.exports = router;
