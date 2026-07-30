#!/usr/bin/env node
/**
 * Create the first Super Admin for Admin Web (email + password).
 *
 * Non-interactive (preferred for scripts / CI):
 *   SUPER_ADMIN_EMAIL=admin@example.com \
 *   SUPER_ADMIN_PASSWORD='SecurePass123' \
 *   SUPER_ADMIN_FULL_NAME='Telefonak Super Admin' \
 *   node scripts/create-super-admin.js
 *
 * Interactive:
 *   node scripts/create-super-admin.js
 *
 * Refuses to run if a super_admin already exists.
 * Does not touch the mobile users table.
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Pool } = require('pg');
const { ADMIN_ROLES } = require('../utils/adminAuth');

dotenv.config();

const BCRYPT_ROUNDS = 12;
const MIN_PASSWORD_LENGTH = 8;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telefonak',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

function ask(question, { silent = false } = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    if (!silent) {
      rl.question(question, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    // Hide password input on TTY when possible
    process.stdout.write(question);
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode?.(true);
    stdin.setEncoding('utf8');

    let buffer = '';
    const onData = (char) => {
      if (char === '\n' || char === '\r' || char === '\u0004') {
        stdin.setRawMode?.(false);
        stdin.removeListener('data', onData);
        process.stdout.write('\n');
        rl.close();
        resolve(buffer.trim());
        return;
      }
      if (char === '\u0003') {
        process.exit(1);
      }
      if (char === '\u007f') {
        buffer = buffer.slice(0, -1);
        return;
      }
      buffer += char;
      process.stdout.write('*');
    };
    stdin.on('data', onData);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function resolveInputs() {
  let email = process.env.SUPER_ADMIN_EMAIL?.trim() || '';
  let password = process.env.SUPER_ADMIN_PASSWORD || '';
  let fullName = process.env.SUPER_ADMIN_FULL_NAME?.trim() || '';

  const interactive = !(email && password && fullName);

  if (interactive) {
    console.log('Create the first Telefonak Super Admin\n');
    fullName = fullName || (await ask('Full name: '));
    email = email || (await ask('Email: '));
    password = password || (await ask('Password: ', { silent: true }));
  }

  if (!fullName) {
    throw new Error('Full name is required');
  }
  if (!isValidEmail(email)) {
    throw new Error('A valid email is required');
  }
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  return {
    email: email.toLowerCase(),
    password,
    fullName,
  };
}

async function main() {
  try {
    const existingSuper = await pool.query(
      `SELECT id, email FROM admins WHERE role = $1 LIMIT 1`,
      [ADMIN_ROLES.SUPER_ADMIN]
    );

    if (existingSuper.rows.length > 0) {
      console.error(
        `A Super Admin already exists (${existingSuper.rows[0].email}). Aborting.`
      );
      process.exit(1);
    }

    const { email, password, fullName } = await resolveInputs();

    const duplicate = await pool.query(
      'SELECT id FROM admins WHERE email = $1',
      [email]
    );
    if (duplicate.rows.length > 0) {
      console.error(`An admin with email ${email} already exists. Aborting.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const inserted = await pool.query(
      `INSERT INTO admins (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, $4, TRUE)
       RETURNING id, full_name, email, role, is_active, created_at`,
      [fullName, email, passwordHash, ADMIN_ROLES.SUPER_ADMIN]
    );

    const admin = inserted.rows[0];
    console.log('\n✅ Super Admin created successfully');
    console.log(`   ID:    ${admin.id}`);
    console.log(`   Name:  ${admin.full_name}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Role:  ${admin.role}`);
    console.log('\nLog in via POST /api/admin/auth/login');
    process.exit(0);
  } catch (error) {
    console.error('Failed to create Super Admin:', error.message || error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
