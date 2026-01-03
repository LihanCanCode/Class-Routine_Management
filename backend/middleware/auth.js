const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
    try {
        // Get token from header or query parameter
        let token = req.header('Authorization')?.replace('Bearer ', '');
        
        // If not in header, check query parameter (for PDF viewing in new tab)
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ 
                error: 'No authentication token, access denied' 
            });
        }

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');

        // Find user
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({ 
                error: 'User not found or inactive' 
            });
        }

        // Attach user to request
        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ 
            error: 'Token is not valid' 
        });
    }
};

// Middleware to restrict access to admin and super-admin only
const adminOnly = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ 
            error: 'Authentication required' 
        });
    }

    if (req.user.role !== 'admin' && req.user.role !== 'super-admin') {
        return res.status(403).json({ 
            error: 'Access denied. Admin privileges required.' 
        });
    }

    next();
};

// Middleware for routes that allow guest access (viewing only)
const authOrGuest = async (req, res, next) => {
    try {
        // Check for guest mode header or query parameter
        const guestMode = req.header('X-Guest-Mode') || req.query.guestMode;
        
        if (guestMode === 'true') {
            // Create a guest user object
            req.user = {
                role: 'viewer',
                isGuest: true,
                name: 'Guest'
            };
            return next();
        }

        // Otherwise, use normal auth
        let token = req.header('Authorization')?.replace('Bearer ', '');
        
        if (!token && req.query.token) {
            token = req.query.token;
        }

        if (!token) {
            return res.status(401).json({ 
                error: 'No authentication token, access denied' 
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-change-in-production');
        const user = await User.findById(decoded.userId);

        if (!user || !user.isActive) {
            return res.status(401).json({ 
                error: 'User not found or inactive' 
            });
        }

        req.user = user;
        next();
    } catch (error) {
        console.error('Auth middleware error:', error);
        res.status(401).json({ 
            error: 'Token is not valid' 
        });
    }
};

module.exports = auth;
module.exports.adminOnly = adminOnly;
module.exports.authOrGuest = authOrGuest;
module.exports.adminOnly = adminOnly;
