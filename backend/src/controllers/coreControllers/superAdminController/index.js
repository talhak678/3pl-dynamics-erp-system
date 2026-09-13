const listUsers = require('./listUsers');
const createUser = require('./createUser');
const toggleUserStatus = require('./toggleUserStatus');
const updateUserPermissions = require('./updateUserPermissions');

const superAdminController = {
  listUsers,
  createUser,
  toggleUserStatus,
  updateUserPermissions,
};

module.exports = superAdminController;
