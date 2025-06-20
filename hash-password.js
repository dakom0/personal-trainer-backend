const bcrypt = require('bcryptjs');

const password = process.argv[2];

if (!password) {
  console.error('Usage: node hash-password.js <password>');
  process.exit(1);
}

const saltRounds = 10;
bcrypt.hash(password, saltRounds, function (err, hash) {
  if (err) {
    console.error('Error hashing password:', err);
    process.exit(1);
  }
  console.log('Your new password hash is:');
  console.log(hash);
}); 