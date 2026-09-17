const { resolveModules, isValidModuleKey } = require('../../utils/moduleList');

/**
 * What an owner is allowed to hand out, and what they asked to hand out.
 *
 * The rule this file exists to enforce: an owner may only grant modules they
 * hold themselves. Without it the permission model is decorative - an owner
 * restricted to Invoices could create an employee holding Expenses and read
 * through them everything the owner was denied.
 */

/** The modules the calling owner may grant - their own effective set. */
const grantableModules = (owner) => resolveModules(owner);

/**
 * Validates a requested permission list against the owner's own.
 *
 * Returns `{ value }` on success and `{ error, status }` on failure, so callers
 * decide how to respond rather than this module writing to `res`.
 *
 * The empty case is rejected rather than accepted, and that is the whole point
 * of the check. An empty `modulePermissions` array means EVERY module to
 * `resolveModules`, so an employee saved with nothing ticked would silently
 * receive more access than the owner who created them - the exact inversion of
 * what the form appears to do. There is no way to express "no modules" through
 * this field, so the honest answer is to refuse and say so.
 */
const validateRequestedModules = (requested, owner) => {
  if (requested === undefined) {
    return {
      error: 'modulePermissions is required: select at least one module for this user.',
      status: 400,
    };
  }

  if (!Array.isArray(requested)) {
    return { error: 'modulePermissions must be an array of module keys', status: 400 };
  }

  // Reject the whole request rather than writing a partial list, so a typo
  // cannot quietly drop a module the admin believed they had assigned.
  const unknown = requested.filter((key) => !isValidModuleKey(key));

  if (unknown.length > 0) {
    return { error: `Unknown module key(s): ${unknown.join(', ')}`, status: 400 };
  }

  const deduped = [...new Set(requested)];

  if (deduped.length === 0) {
    return {
      error:
        'Select at least one module. An empty permission list grants every module, so it cannot be used to restrict a user.',
      status: 400,
    };
  }

  const grantable = grantableModules(owner);
  const beyondOwn = deduped.filter((key) => !grantable.includes(key));

  if (beyondOwn.length > 0) {
    return {
      error: `You cannot grant modules your own account does not have: ${beyondOwn.join(', ')}`,
      status: 403,
    };
  }

  return { value: deduped };
};

module.exports = { grantableModules, validateRequestedModules };
