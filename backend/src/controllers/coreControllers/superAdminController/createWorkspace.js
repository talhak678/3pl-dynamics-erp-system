const mongoose = require('mongoose');
const Joi = require('joi');

const serializeWorkspace = require('./serializeWorkspace');

/**
 * POST /api/superadmin/workspaces
 *
 * Creates a workspace. This is the first half of the provisioning flow - a
 * workspace exists before any account can be attached to it.
 *
 * `isActive` and `removed` are not read from the request body: a workspace is
 * born active (otherwise it could never be selected in the Create User
 * dropdown) and is only ever deactivated through the status endpoint. Same
 * reasoning as createUser refusing to read `isSuperAdmin` from a body.
 *
 * `createdBy` records the calling super admin. It is taken from `req.admin`,
 * which the auth middleware populated, rather than the body, so the audit trail
 * cannot be attributed to someone else.
 */
const createWorkspace = async (req, res) => {
  const Workspace = mongoose.model('Workspace');

  const { code, name, customerName, customerEmail, customerPhone } = req.body;

  const objectSchema = Joi.object({
    code: Joi.string()
      .trim()
      .uppercase()
      .max(50)
      .pattern(/^[A-Z0-9_-]+$/)
      .required()
      .messages({
        'string.pattern.base':
          'Code may contain only uppercase letters, numbers, underscores and hyphens',
      }),
    name: Joi.string().trim().max(255).required(),
    customerName: Joi.string().trim().max(255).allow('', null),
    customerEmail: Joi.string()
      .trim()
      .email({ tlds: { allow: true } })
      .max(255)
      .allow('', null),
    customerPhone: Joi.string().trim().max(20).allow('', null),
  });

  const { error, value } = objectSchema.validate({
    code,
    name,
    customerName,
    customerEmail,
    customerPhone,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      result: null,
      error,
      message: error.message,
    });
  }

  // Checked before the insert so the common case reports a readable conflict
  // rather than a duplicate-key error. The unique index is still the real
  // guarantee - two requests racing past this check are caught below.
  const existing = await Workspace.findOne({ code: value.code, removed: false }).exec();

  if (existing) {
    return res.status(409).json({
      success: false,
      result: null,
      message: `A workspace with the code ${value.code} already exists`,
    });
  }

  let workspace;

  try {
    workspace = await new Workspace({
      code: value.code,
      name: value.name,
      customerName: value.customerName || '',
      customerEmail: value.customerEmail || '',
      customerPhone: value.customerPhone || '',
      isActive: true,
      removed: false,
      createdBy: req.admin ? req.admin._id : null,
    }).save();
  } catch (saveError) {
    // The unique index on `code` rejecting a concurrent insert. Reported as the
    // same conflict as the check above, because to the caller it is the same
    // outcome.
    if (saveError && saveError.code === 11000) {
      return res.status(409).json({
        success: false,
        result: null,
        message: `A workspace with the code ${value.code} already exists`,
      });
    }

    throw saveError;
  }

  return res.status(201).json({
    success: true,
    result: serializeWorkspace(workspace),
    message: 'Workspace created successfully',
  });
};

module.exports = createWorkspace;
