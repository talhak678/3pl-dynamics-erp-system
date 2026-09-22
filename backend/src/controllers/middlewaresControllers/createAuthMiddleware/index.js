const isValidAuthToken = require('./isValidAuthToken');
const login = require('./login');
const logout = require('./logout');
const me = require('./me');
const forgetPassword = require('./forgetPassword');
const resetPassword = require('./resetPassword');

const createAuthMiddleware = (userModel) => {
  let authMethods = {};

  authMethods.isValidAuthToken = (req, res, next) =>
    isValidAuthToken(req, res, next, {
      userModel,
    });

  authMethods.login = (req, res) =>
    login(req, res, {
      userModel,
    });

  authMethods.forgetPassword = (req, res) =>
    forgetPassword(req, res, {
      userModel,
    });

  authMethods.resetPassword = (req, res) =>
    resetPassword(req, res, {
      userModel,
    });

  authMethods.logout = (req, res) =>
    logout(req, res, {
      userModel,
    });

  // Unlike the five above, this one needs no dependencies. They read or write a
  // password row and so need to know which model pair they are working on; this
  // only describes the account isValidAuthToken already loaded.
  authMethods.me = (req, res) => me(req, res);

  return authMethods;
};

module.exports = createAuthMiddleware;
