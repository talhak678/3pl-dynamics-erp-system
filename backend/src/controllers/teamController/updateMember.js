const mongoose = require('mongoose');
const Joi = require('joi');
const { generate: uniqueId } = require('shortid');

const { validateRequestedModules, grantableModules } = require('./permissions');
const { validateRequestedRole } = require('./roles');
const { ASSIGNABLE_ROLES } = require('../../utils/roles');
const serializeMember = require('./serializeMember');

/**
 * PATCH /api/team/:id
 *
 * Updates an employee in the calling owner's workspace.
 *
 * Every field is optional, so the same endpoint backs both "edit the details"
 * and "toggle this person off".
 *
 * Three fields are deliberately not writable here:
 *
 *   isSuperAdmin  promoting an employee to the control plane is not something
 *                 one tenant does to another account in its own workspace. An
 *                 owner editing their own employee must not be a path to a
 *                 super admin.
 *   parentAdminId reparenting is how an account would be moved into another
 *                 tenant. There is no supported way to do it.
 *   enabled       the login switch, kept server-side so it cannot be used to
 *                 re-enable an account the platform disabled. isActive is the
 *                 tenant's own switch and IS settable.
 *
 * `role` IS writable, but only within the assignable set - see roles.js. It is
 * a job title for the workspace, so a manager becoming a sales executive is a
 * routine edit; 'owner' and 'superadmin' are refused because they are the two
 * values the rest of the system authorises on.
 */
const updateMember = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const { name, surname, email, password, modulePermissions, isActive, role } = req.body;

  const notFound = () =>
    res.status(404).json({
      success: false,
      result: null,
      message: 'No member found by this id: ' + req.params.id,
    });

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return notFound();
  }

  // Scoped in the lookup so another tenant's account is a 404 rather than an
  // update this handler would then have to remember to refuse.
  const member = await Admin.findOne({
    _id: req.params.id,
    parentAdminId: req.admin._id,
    removed: false,
  }).exec();

  if (!member) {
    return notFound();
  }

  const updates = {};

  if (name !== undefined) {
    const { error, value } = Joi.object({ name: Joi.string().required() }).validate({ name });

    if (error) {
      return res.status(400).json({ success: false, result: null, message: error.message });
    }

    updates.name = value.name;
  }

  if (surname !== undefined) updates.surname = surname;

  if (email !== undefined) {
    const { error, value } = Joi.object({
      email: Joi.string()
        .email({ tlds: { allow: true } })
        .required(),
    }).validate({ email });

    if (error) {
      return res.status(400).json({ success: false, result: null, message: error.message });
    }

    const normalisedEmail = value.email.trim().toLowerCase();

    if (normalisedEmail !== member.email) {
      // Global, for the same reason as create: email is the login key.
      const clash = await Admin.findOne({
        email: normalisedEmail,
        removed: false,
        _id: { $ne: member._id },
      });

      if (clash) {
        return res.status(409).json({
          success: false,
          result: null,
          message: 'An account with this email already exists',
        });
      }

      updates.email = normalisedEmail;
    }
  }

  if (isActive !== undefined) updates.isActive = isActive === true;

  // Guarded on `undefined` rather than always run, because this handler treats
  // every absent field as "leave it alone" - and validateRequestedRole resolves
  // an absent role to its default. Calling it unconditionally would silently
  // rewrite every member's job title to DEFAULT_MEMBER_ROLE on any partial
  // update, such as the status toggle the card's drawer sends.
  //
  // `unchangedFrom` is this member's current title, and it is what lets an
  // account carrying a retired one - 'Manager', 'Digital Marketer', 'admin', or
  // the pre-rename 'employee' and 'Customer Support' - still be edited. The
  // drawer echoes the title it was given when it has no option for it, so
  // without this the request would carry a retired title and be refused, and
  // such a member's name or status could not be changed without changing their
  // job title as a side effect of saving. See teamController/roles.js.
  if (role !== undefined) {
    const roleAssignment = validateRequestedRole(role, { unchangedFrom: member.role });

    if (roleAssignment.error) {
      return res.status(roleAssignment.status).json({
        success: false,
        result: null,
        message: roleAssignment.error,
        assignableRoles: ASSIGNABLE_ROLES,
      });
    }

    updates.role = roleAssignment.value;
  }

  if (modulePermissions !== undefined) {
    const permissions = validateRequestedModules(modulePermissions, req.admin);

    if (permissions.error) {
      return res.status(permissions.status).json({
        success: false,
        result: null,
        message: permissions.error,
        grantableModules: grantableModules(req.admin),
      });
    }

    updates.modulePermissions = permissions.value;
  }

  if (password !== undefined) {
    const { error } = Joi.object({ password: Joi.string().min(8).required() }).validate({ password });

    if (error) {
      return res.status(400).json({ success: false, result: null, message: error.message });
    }
  }

  const result = await Admin.findOneAndUpdate(
    { _id: member._id },
    { $set: updates },
    { new: true, runValidators: true }
  ).exec();

  if (password !== undefined) {
    const salt = uniqueId();
    const passwordHash = new AdminPassword().generateHash(salt, password);

    // `loggedSessions` is emptied as part of the change. The session list is
    // what isValidAuthToken checks a token against, so clearing it is what
    // actually ends the employee's live sessions - otherwise a password reset
    // prompted by a suspected compromise would leave the existing session
    // working until its token expired.
    await AdminPassword.findOneAndUpdate(
      { user: member._id },
      { $set: { salt, password: passwordHash, loggedSessions: [] } },
      { new: true }
    ).exec();
  }

  return res.status(200).json({
    success: true,
    result: serializeMember(result),
    message: 'User updated successfully',
  });
};

module.exports = updateMember;
