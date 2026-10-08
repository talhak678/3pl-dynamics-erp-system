const mongoose = require('mongoose');

const serializeAdmin = require('./serializeAdmin');

/**
 * GET /api/superadmin/users
 *
 * Lists every admin account, including the calling super admin - or, when the
 * portal's workspace dropdown has a value in it, the accounts of that one
 * workspace.
 *
 * `workspace` is an optional query parameter holding a Workspace id. Absent -
 * which is what the portal sends once its dropdown is cleared - the query is
 * the unfiltered one and every account comes back, so clearing the filter asks
 * exactly the question this endpoint answered before the filter existed. An
 * empty string counts as absent for the same reason: it is what a naive client
 * produces for "no value", and it is not a workspace anyone can mean.
 *
 * The id is validated before it reaches the query, because a malformed one
 * cannot come from the portal - so it means a hand-made request or a bug - and
 * answering 400 says which, where returning an empty list would read as "this
 * workspace has no accounts". The check is for the 24-hex-character form rather
 * than mongoose.Types.ObjectId.isValid, which also accepts any twelve-character
 * string and would cast 'abcdefghijkl' into a perfectly valid ObjectId built
 * from those bytes: a filter on a workspace that cannot exist, answered with an
 * empty list instead of an error.
 *
 * It is an exact match on the reference, and accounts with no workspace at all
 * carry null there - so they are correctly absent from every filtered view and
 * still present in the unfiltered one. They are not lost, and they are not
 * silently attributed to whichever workspace happened to be selected.
 *
 * This is a control-plane endpoint behind requireSuperAdmin and it is not
 * tenant scoped: seeing across workspaces is what a super admin is for, and
 * this filter narrows that view rather than granting anything.
 *
 * The workspace is populated so the list can name it rather than showing an
 * id. serializeAdmin handles a populated path and a bare id alike, so the
 * population here is presentation only and nothing downstream depends on it -
 * which is what keeps a row whose workspace was deleted, and therefore does not
 * populate, from breaking the payload.
 */
const listUsers = async (req, res) => {
  const Admin = mongoose.model('Admin');

  const { workspace } = req.query;

  const conditions = { removed: false };

  if (workspace) {
    if (!/^[0-9a-fA-F]{24}$/.test(workspace)) {
      return res.status(400).json({
        success: false,
        result: null,
        message: 'The workspace filter is not a valid workspace id',
      });
    }

    conditions.workspace = new mongoose.Types.ObjectId(workspace);
  }

  // Projection is a second line of defence behind serializeAdmin.
  const result = await Admin.find(conditions)
    .select('name email enabled isActive isSuperAdmin modulePermissions workspace created')
    .populate('workspace', 'code name')
    .sort({ created: 1 })
    .exec();

  return res.status(200).json({
    success: true,
    result: result.map(serializeAdmin),
    message: 'Successfully found all users',
  });
};

module.exports = listUsers;
