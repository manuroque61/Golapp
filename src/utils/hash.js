const bcrypt = require('bcryptjs');

async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plain, salt);
}
async function comparePassword(plain, hash) {
  return await bcrypt.compare(plain, hash);
}
module.exports = { hashPassword, comparePassword };
