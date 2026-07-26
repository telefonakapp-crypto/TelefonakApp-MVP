const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telefonak',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function makeAdmin() {
  try {
    const phoneNumber = process.argv[2];
    
    if (!phoneNumber) {
      console.error('Usage: node make-admin.js <phone_number>');
      console.error('Example: node make-admin.js 0791234567');
      process.exit(1);
    }

    console.log(`Making user with phone number ${phoneNumber} an admin...`);
    
    const result = await pool.query(
      'UPDATE users SET is_admin = TRUE WHERE phone_number = $1 RETURNING id, first_name, last_name, phone_number, is_admin',
      [phoneNumber]
    );

    if (result.rows.length === 0) {
      console.error(`User with phone number ${phoneNumber} not found!`);
      process.exit(1);
    }

    const user = result.rows[0];
    console.log('✅ User successfully made admin:');
    console.log(`   Name: ${user.first_name} ${user.last_name}`);
    console.log(`   Phone: ${user.phone_number}`);
    console.log(`   Admin: ${user.is_admin}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error making user admin:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

makeAdmin();

