const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'telefonak',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function initDatabase() {
  try {
    console.log('Connecting to database...');
    
    // Run main schema
    const schemaPath = path.join(__dirname, '../database/schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    
    console.log('Running main schema...');
    await pool.query(schema);
    
    // Run listings schema
    const listingsSchemaPath = path.join(__dirname, '../database/listings_schema.sql');
    const listingsSchema = fs.readFileSync(listingsSchemaPath, 'utf8');
    
    console.log('Running listings schema...');
    await pool.query(listingsSchema);
    
    // Run phone models data
    const phoneModelsPath = path.join(__dirname, '../database/phone_models_jordan.sql');
    const phoneModels = fs.readFileSync(phoneModelsPath, 'utf8');
    
    console.log('Running phone models data...');
    await pool.query(phoneModels);
    
    // Run admin schema
    const adminSchemaPath = path.join(__dirname, '../database/admin_schema.sql');
    const adminSchema = fs.readFileSync(adminSchemaPath, 'utf8');
    
    console.log('Running admin schema...');
    await pool.query(adminSchema);
    
    // Run ads schema
    const adsSchemaPath = path.join(__dirname, '../database/ads_schema.sql');
    const adsSchema = fs.readFileSync(adsSchemaPath, 'utf8');
    
    console.log('Running ads schema...');
    await pool.query(adsSchema);
    
    console.log('Database initialized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

initDatabase();

