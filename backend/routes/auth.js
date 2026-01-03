const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/auth/login
// @desc    Login admin user
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({ 
                error: 'Please provide email and password' 
            });
        }

        // Find user
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(401).json({ 
                error: 'Account is inactive. Please contact administrator.' 
            });
        }

        // Check password
        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ 
                error: 'Invalid credentials' 
            });
        }

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, department: user.department },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                department: user.department,
                role: user.role,
                batch: user.batch
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ 
            error: 'Server error during login' 
        });
    }
});

// @route   POST /api/auth/register
// @desc    Register new admin (only accessible by existing admin for now)
// @access  Public (will be protected later)
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, department, role } = req.body;

        // Validation
        if (!name || !email || !password) {
            return res.status(400).json({ 
                error: 'Please provide name, email and password' 
            });
        }

        if (password.length < 6) {
            return res.status(400).json({ 
                error: 'Password must be at least 6 characters' 
            });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ 
                error: 'User with this email already exists' 
            });
        }

        // Create new user - default to CR if no role specified
        const user = new User({
            name,
            email,
            password,
            department: department || 'CSE',
            role: role || 'cr'
        });

        await user.save();

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, department: user.department },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '7d' }
        );

        res.status(201).json({
            success: true,
            message: `${user.role.toUpperCase()} user created successfully`,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                department: user.department,
                role: user.role,
                batch: user.batch
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ 
            error: 'Server error during registration' 
        });
    }
});

// @route   GET /api/auth/me
// @desc    Get current logged in user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        res.json({
            success: true,
            user: {
                id: req.user._id,
                name: req.user.name,
                email: req.user.email,
                department: req.user.department,
                role: req.user.role,
                batch: req.user.batch
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            error: 'Server error' 
        });
    }
});

module.exports = router;
