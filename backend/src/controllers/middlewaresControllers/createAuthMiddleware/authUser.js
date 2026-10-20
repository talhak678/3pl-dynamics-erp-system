const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { resolveModules } = require('../../../utils/moduleList');

const authUser = async (req, res, { user, databasePassword, password, UserPasswordModel }) => {
  const isMatch = await bcrypt.compare(databasePassword.salt + password, databasePassword.password);

  if (!isMatch)
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Invalid credentials.',
    });

  if (isMatch === true) {
    const token = jwt.sign(
      {
        id: user._id,
      },
      process.env.JWT_SECRET,
      { expiresIn: req.body.remember ? 365 * 24 + 'h' : '24h' }
    );

    await UserPasswordModel.findOneAndUpdate(
      { user: user._id },
      { $push: { loggedSessions: token } },
      {
        new: true,
      }
    ).exec();

    // .cookie(`token_${user.cloud}`, token, {
    //     maxAge: req.body.remember ? 365 * 24 * 60 * 60 * 1000 : null,
    //     sameSite: 'None',
    //     httpOnly: true,
    //     secure: true,
    //     domain: req.hostname,
    //     path: '/',
    //     Partitioned: true,
    //   })
    res.status(200).json({
      success: true,
      result: {
        _id: user._id,
        name: user.name,
        surname: user.surname,
        role: user.role,
        email: user.email,
        photo: user.photo,
        isSuperAdmin: user.isSuperAdmin === true,
        // Returned resolved so the client never has to reimplement the
        // "empty means all modules" rule.
        modulePermissions: resolveModules(user),
        // The stored allow-list, before that expansion. The sidebar needs it to
        // tell "granted because the list is empty (everything)" apart from
        // "granted by an administrator", which is the only way the roadmap
        // parents can stay hidden by default. It is a copy, not the Mongoose
        // array, so the client cannot mutate this document's state through it.
        storedModulePermissions: Array.isArray(user.modulePermissions)
          ? [...user.modulePermissions]
          : [],
        token: token,
        maxAge: req.body.remember ? 365 : null,
      },
      message: 'Successfully login user',
    });
  } else {
    return res.status(403).json({
      success: false,
      result: null,
      message: 'Invalid credentials.',
    });
  }
};

module.exports = authUser;
