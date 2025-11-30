const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function setupUsers() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: 'localhost',
      port: 3306,
      user: 'root',
      password: 'root',
      database: 'iterary'
    });

    console.log('✅ Connected to database');

    // Hash passwords
    const adminPassword = await bcrypt.hash('admin123', 10);
    const memberPassword = await bcrypt.hash('member123', 10);

    console.log('✅ Passwords hashed');

    // Delete existing data
    await connection.execute('DELETE FROM admins');
    await connection.execute('DELETE FROM members');

    console.log('✅ Cleared existing users');

    // Insert admin
    await connection.execute(
      'INSERT INTO admins (username, password_hash, name, email, role) VALUES (?, ?, ?, ?, ?)',
      ['admin', adminPassword, 'Admin ITERARY', 'admin@itera.ac.id', 'admin']
    );

    console.log('✅ Admin created:');
    console.log('   Username: admin');
    console.log('   Password: admin123');

    // Insert sample members
    const members = [
      ['120450001', 'Budi Santoso', 'budi@students.itera.ac.id', '081234567890', 'student'],
      ['120450002', 'Siti Nurhaliza', 'siti@students.itera.ac.id', '081234567891', 'student'],
      ['120450003', 'Ahmad Fadli', 'ahmad@students.itera.ac.id', '081234567892', 'student']
    ];

    for (const [memberId, name, email, phone, type] of members) {
      await connection.execute(
        'INSERT INTO members (member_id, name, email, phone, password_hash, member_type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [memberId, name, email, phone, memberPassword, type, 'active']
      );
    }

    console.log('✅ Members created (3 users):');
    console.log('   Email: budi@students.itera.ac.id');
    console.log('   Email: siti@students.itera.ac.id');
    console.log('   Email: ahmad@students.itera.ac.id');
    console.log('   Password (semua): member123');

    await connection.end();
    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📝 Login credentials:');
    console.log('   ADMIN -> username: admin, password: admin123');
    console.log('   MEMBER -> email: budi@students.itera.ac.id, password: member123');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

setupUsers();
