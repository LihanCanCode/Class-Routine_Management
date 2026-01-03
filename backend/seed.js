// Seed script to create the first admin user
// Run: node seed.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const createAdmin = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB connected');

        // Check if admin already exists
        const existingAdmin = await User.findOne({ email: 'admin@cse.edu' });
        if (existingAdmin) {
            console.log('⚠️  Admin user already exists');
            console.log('Email:', existingAdmin.email);
            console.log('Department:', existingAdmin.department);
            process.exit(0);
        }

        // Create admin user
        const admin = new User({
            name: 'CSE Admin',
            email: 'admin@cse.edu',
            password: 'admin123', // Change this password after first login!
            department: 'CSE',
            role: 'admin'
        });

        await admin.save();

        console.log('✅ Admin user created successfully!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 Email:', admin.email);
        console.log('🔑 Password: admin123');
        console.log('🏢 Department:', admin.department);
        console.log('👤 Role:', admin.role);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('⚠️  IMPORTANT: Change the default password after first login!');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error creating admin:', error);
        process.exit(1);
    }
};

createAdmin();
