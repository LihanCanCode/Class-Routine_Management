const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// @route   POST /api/auth/guest-login
// @desc    Create/login guest user
// @access  Public
router.post('/guest-login', async (req, res) => {
    try {
        const { name, pageNumber } = req.body;

        if (!name || !pageNumber) {
            return res.status(400).json({
                error: 'Please provide name and preferred batch'
            });
        }

        // Generate a pseudo-random email for the guest account
        // If we want to truly "remember" them without a token later, we'd need a more complex system,
        // but for now, this creates a valid user record they can use with their token.
        const guestEmail = `guest_${Date.now()}_${Math.floor(Math.random() * 1000)}@system.local`;

        const user = new User({
            name,
            email: guestEmail,
            role: 'viewer',
            isGuest: true,
            preferredSemesterPage: pageNumber
        });

        await user.save();

        // Create JWT token
        const token = jwt.sign(
            { userId: user._id, department: user.department },
            process.env.JWT_SECRET || 'your-secret-key-change-in-production',
            { expiresIn: '30d' } // Long lived token for guests
        );

        res.status(201).json({
            success: true,
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                isGuest: user.isGuest,
                preferredSemesterPage: user.preferredSemesterPage
            }
        });
    } catch (error) {
        console.error('Guest login error:', error);
        res.status(500).json({
            error: 'Server error during guest login'
        });
    }
});

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
                batch: req.user.batch,
                tutorialCompleted: req.user.tutorialCompleted,
                tutorialProgress: req.user.tutorialProgress
            }
        });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({
            error: 'Server error'
        });
    }
});

// @route   PUT /api/auth/tutorial-skip
// @desc    Mark tutorial as skipped
// @access  Private
router.put('/tutorial-skip', auth, async (req, res) => {
    try {
        req.user.tutorialProgress.skipped = true;
        req.user.tutorialProgress.lastAccessed = new Date();
        await req.user.save();

        res.json({
            success: true,
            message: 'Tutorial skipped successfully'
        });
    } catch (error) {
        console.error('Tutorial skip error:', error);
        res.status(500).json({
            error: 'Server error'
        });
    }
});

// @route   PUT /api/auth/tutorial-complete
// @desc    Mark tutorial as completed
// @access  Private
router.put('/tutorial-complete', auth, async (req, res) => {
    try {
        req.user.tutorialCompleted = true;
        req.user.tutorialProgress.lastAccessed = new Date();
        await req.user.save();

        res.json({
            success: true,
            message: 'Tutorial completed successfully'
        });
    } catch (error) {
        console.error('Tutorial complete error:', error);
        res.status(500).json({
            error: 'Server error'
        });
    }
});

// @route   PUT /api/auth/tutorial-reset
// @desc    Reset tutorial progress
// @access  Private
router.put('/tutorial-reset', auth, async (req, res) => {
    try {
        req.user.tutorialCompleted = false;
        req.user.tutorialProgress = {
            currentStep: 0,
            completedSteps: [],
            lastAccessed: null,
            skipped: false
        };
        await req.user.save();

        res.json({
            success: true,
            message: 'Tutorial reset successfully'
        });
    } catch (error) {
        console.error('Tutorial reset error:', error);
        res.status(500).json({
            error: 'Server error'
        });
    }
});

module.exports = router;
