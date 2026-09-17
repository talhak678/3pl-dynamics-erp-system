const listTeam = require('./listTeam');
const createMember = require('./createMember');
const readMember = require('./readMember');
const updateMember = require('./updateMember');
const removeMember = require('./removeMember');

/**
 * Employee management for a Customer Admin's own workspace.
 *
 * Deliberately separate from superAdminController rather than parameterised off
 * it. The two look alike but answer different questions: the super admin
 * manages every account on the deployment and may set any module key, while
 * this manages one workspace's employees and may only hand out modules the
 * caller already holds. Sharing an implementation would mean the isolation and
 * the subset rule lived behind a flag, which is precisely the kind of switch
 * that gets set wrong once and leaks a tenant.
 */
const teamController = {
  listTeam,
  createMember,
  readMember,
  updateMember,
  removeMember,
};

module.exports = teamController;
