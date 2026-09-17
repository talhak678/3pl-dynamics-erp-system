const mongoose = require('mongoose');

const { resolveModules } = require('../../../utils/moduleList');

/**
 * Brings a tenant owner's employees back inside the owner's own module set.
 *
 * Called when a super admin changes a tenant owner's permissions. The subset
 * rule in teamController is enforced when an employee is written, which is the
 * moment the owner's grants are known - but nothing re-checks it afterwards, so
 * without this a super admin narrowing a tenant from every module down to
 * Invoices would leave that tenant's employees still holding Quotes, Expenses
 * and the rest. Access granted once and never revoked is the failure mode that
 * makes an audit pointless, so the shrink has to propagate.
 *
 * Two outcomes per employee:
 *
 *   Some modules survive  -> the employee keeps the intersection. They lose
 *                           exactly what the owner lost and nothing else.
 *   Nothing survives     -> the account is suspended.
 *
 * The second case is not a shortcut, it is the only safe answer available. An
 * empty `modulePermissions` list does not mean "no modules" - resolveModules
 * reads it as EVERY module - so writing the empty intersection would hand the
 * employee more access than the owner, which is the precise escalation this
 * whole mechanism exists to prevent. Of the alternatives, leaving the employee
 * untouched keeps access the owner no longer has, and there is no way to
 * express "no modules" through this field. Suspending is the one option that
 * denies rather than grants, and it is visible in the owner's user list and
 * reversible by the owner, so it fails loudly instead of silently.
 *
 * Never throws: it runs after the super admin's write has already committed, so
 * an error here must not turn a successful update into a failed response.
 */
const clampChildren = async (ownerId, ownerPermissions) => {
  try {
    const Admin = mongoose.model('Admin');

    const grantable = resolveModules({ modulePermissions: ownerPermissions });

    const children = await Admin.find({ parentAdminId: ownerId, removed: false })
      .select('name email modulePermissions')
      .exec();

    if (children.length === 0) return { adjusted: 0, suspended: 0 };

    const operations = [];
    let adjusted = 0;
    let suspended = 0;

    for (const child of children) {
      const current = Array.isArray(child.modulePermissions) ? child.modulePermissions : [];

      // An employee on the empty list already reads as "every module", so their
      // effective set is the whole catalogue and must be clamped too.
      const effective = resolveModules(child);

      // Already inside the owner's set - the common case, and a no-op.
      if (effective.every((key) => grantable.includes(key))) continue;

      const kept = effective.filter((key) => grantable.includes(key));

      operations.push({
        updateOne: {
          filter: { _id: child._id },
          update:
            kept.length > 0
              ? { $set: { modulePermissions: kept } }
              : { $set: { modulePermissions: [], isActive: false } },
        },
      });

      if (kept.length > 0) {
        adjusted += 1;
      } else {
        suspended += 1;
      }
    }

    if (operations.length > 0) {
      await Admin.bulkWrite(operations, { ordered: false });

      console.warn(
        `Permissions narrowed for tenant ${ownerId}: ${adjusted} employee(s) clamped, ` +
          `${suspended} suspended (no module left to hold).`
      );
    }

    return { adjusted, suspended };
  } catch (error) {
    console.error('Could not clamp employee permissions after an owner update:', error);
    return { adjusted: 0, suspended: 0, error: error.message };
  }
};

module.exports = clampChildren;
