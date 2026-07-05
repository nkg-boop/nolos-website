#!/usr/bin/env node

// Usage: npm run gen-password-hash
// Prompts for a password (input is not echoed to the terminal), hashes it
// with bcrypt, and prints the hash to paste into .env as ADMIN_PASSWORD_HASH.
// The plaintext password is never written to disk or logged anywhere by
// this script.

const readline = require('readline');
const bcrypt = require('bcryptjs');

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    // Hide input by intercepting the write stream. This is a minimal
    // approach — it hides the password from someone glancing at the
    // screen or a screen recording, though it's not as robust as a
    // dedicated library like `read`. Good enough for a one-off setup step.
    const originalWrite = rl._writeToOutput;
    rl._writeToOutput = function (stringToWrite) {
      if (stringToWrite.trim() === question.trim() || stringToWrite === '\n' || stringToWrite === '\r\n') {
        originalWrite.call(rl, stringToWrite);
      } else {
        originalWrite.call(rl, '*');
      }
    };
    rl.question(question, (answer) => {
      rl.close();
      console.log('');
      resolve(answer);
    });
  });
}

async function main() {
  console.log('This will generate a bcrypt hash for your admin password.');
  console.log('The password itself is never saved — only the hash is printed.\n');

  const password = await promptHidden('Enter the admin password: ');
  const confirm = await promptHidden('Confirm the admin password: ');

  if (password !== confirm) {
    console.error('\nPasswords did not match. Please try again.');
    process.exit(1);
  }

  if (password.length < 10) {
    console.error('\nThat password is quite short. Consider using at least 10-12 characters for an admin account guarding family data.');
  }

  const hash = await bcrypt.hash(password, 12);
  console.log('Add this line to your .env file:\n');
  console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
}

main();
