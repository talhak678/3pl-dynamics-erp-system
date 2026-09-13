const express = require('express');

const router = express.Router();

const { catchErrors } = require('../../handlers/errorHandlers');
const adminAuth = require('../../controllers/coreControllers/adminAuth');
const bootstrapSuperAdmin = require('../../controllers/coreControllers/bootstrapSuperAdmin');

// ONE-TIME route: creates the first super admin, then must be deleted along
// with its controller. See §9 of the super admin design spec for the removal
// checklist.
router.route('/bootstrap-superadmin').get(catchErrors(bootstrapSuperAdmin));

router.route('/login').post(catchErrors(adminAuth.login));

router.route('/forgetpassword').post(catchErrors(adminAuth.forgetPassword));
router.route('/resetpassword').post(catchErrors(adminAuth.resetPassword));

router.route('/logout').post(adminAuth.isValidAuthToken, catchErrors(adminAuth.logout));

module.exports = router;
