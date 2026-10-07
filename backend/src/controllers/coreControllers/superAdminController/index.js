const listUsers = require('./listUsers');
const createUser = require('./createUser');
const toggleUserStatus = require('./toggleUserStatus');
const updateUserPermissions = require('./updateUserPermissions');

const listWorkspaces = require('./listWorkspaces');
const createWorkspace = require('./createWorkspace');
const updateWorkspaceStatus = require('./updateWorkspaceStatus');

const superAdminController = {
  listUsers,
  createUser,
  toggleUserStatus,
  updateUserPermissions,

  listWorkspaces,
  createWorkspace,
  updateWorkspaceStatus,
};

module.exports = superAdminController;
