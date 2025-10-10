const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const config = require('../config');

function signToken(payload, options = {}) {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    ...options,
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

async function hashPassword(plain) {
  return bcrypt.hash(plain, config.bcrypt.rounds);
}

async function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

module.exports = { signToken, verifyToken, hashPassword, checkPassword };
