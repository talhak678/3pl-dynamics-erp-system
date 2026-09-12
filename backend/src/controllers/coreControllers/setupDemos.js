const mongoose = require('mongoose');
const { generate: uniqueId } = require('shortid');

const setupDemos = async (req, res) => {
  const Admin = mongoose.model('Admin');
  const AdminPassword = mongoose.model('AdminPassword');

  const demoUsers = [
    {
      name: 'Talha Khan',
      email: 'demo1@3pldynamicsai.com',
      password: 'Password123',
    },
    {
      name: 'Sahir Ahmed',
      email: 'demo2@3pldynamicsai.com',
      password: 'Password456',
    },
  ];

  for (const demoUser of demoUsers) {
    const existingAdmin = await Admin.findOne({ email: demoUser.email });

    if (existingAdmin) {
      continue;
    }

    const admin = await new Admin({
      name: demoUser.name,
      email: demoUser.email,
      enabled: true,
      role: 'owner',
    }).save();

    const salt = uniqueId();
    const passwordHash = new AdminPassword().generateHash(salt, demoUser.password);

    await new AdminPassword({
      password: passwordHash,
      emailVerified: true,
      salt,
      user: admin._id,
    }).save();
  }

  return res.status(200).json({
    success: true,
    message: 'Demo users created successfully',
  });
};

module.exports = setupDemos;
