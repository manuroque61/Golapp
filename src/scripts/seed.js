const { pool } = require('../config/db');
const { hashPassword } = require('../utils/hash');

async function run(){
  try {
    const adminHash = await hashPassword('admin123');
    const capHash = await hashPassword('capitan123');
    await pool.query("INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      ['Admin Principal','admin@golapp.com',adminHash,'admin']);
    await pool.query("INSERT IGNORE INTO users (name,email,password_hash,role) VALUES (?,?,?,?)",
      ['Carlos Martínez','capitan@golapp.com',capHash,'captain']);
    console.log('Usuarios seed ok');
    process.exit(0);
  } catch (e){
    console.error(e);
    process.exit(1);
  }
}
run();
