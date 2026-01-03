import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [token, setToken] = useState(localStorage.getItem('token'));

    // Check if user is logged in on mount
    useEffect(() => {
        const checkAuth = async () => {
            const savedToken = localStorage.getItem('token');
            const guestMode = localStorage.getItem('guestMode');
            
            if (guestMode === 'true') {
                // Restore guest session
                setUser({
                    name: 'Guest',
                    role: 'viewer',
                    isGuest: true
                });
                setLoading(false);
            } else if (savedToken) {
                try {
                    const response = await axios.get('http://localhost:5000/api/auth/me', {
                        headers: { Authorization: `Bearer ${savedToken}` }
                    });
                    setUser(response.data.user);
                    setToken(savedToken);
                } catch (error) {
                    console.error('Auth check failed:', error);
                    localStorage.removeItem('token');
                    setToken(null);
                    setUser(null);
                }
                setLoading(false);
            } else {
                setLoading(false);
            }
        };
        checkAuth();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await axios.post('http://localhost:5000/api/auth/login', {
                email,
                password
            });

            const { token: newToken, user: userData } = response.data;
            
            localStorage.setItem('token', newToken);
            setToken(newToken);
            setUser(userData);
            
            return { success: true, user: userData };
        } catch (error) {
            console.error('Login error:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    };

    const guestLogin = () => {
        // Set a guest user without token
        const guestUser = {
            name: 'Guest',
            role: 'viewer',
            isGuest: true
        };
        setUser(guestUser);
        localStorage.setItem('guestMode', 'true');
        return { success: true, user: guestUser };
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('guestMode');
        setToken(null);
        setUser(null);
    };

    const value = {
        user,
        token,
        loading,
        isAuthenticated: !!user,
        login,
        guestLogin,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
