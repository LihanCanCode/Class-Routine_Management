import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API from '../services/api';
import { useAuth } from '../context/AuthContext';
import { LogIn, Mail, Lock, AlertCircle, Eye, User, ChevronRight } from 'lucide-react';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [guestName, setGuestName] = useState('');
    const [guestPage, setGuestPage] = useState('');
    const [semesterPages, setSemesterPages] = useState([]);
    const [showGuestForm, setShowGuestForm] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingPages, setLoadingPages] = useState(false);
    const { login, guestLogin } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPages = async () => {
            try {
                setLoadingPages(true);
                // We use the direct endpoint since this is public-accessible via authOrGuest (but might need adjustment if it's strictly private)
                // Actually /api/schedule/semester-pages uses authOrGuest. 
                // However, guests haven't logged in yet. 
                // I might need a public endpoint for pages or allow guests to fetch pages without token.
                // Let's assume for now we might need a public endpoint or update existing one.
                const response = await API.get('/schedule/semester-pages');
                if (response.data.success) {
                    setSemesterPages(response.data.pages || []);
                }
            } catch (err) {
                console.error('Failed to fetch semester pages for login:', err);
            } finally {
                setLoadingPages(false);
            }
        };
        fetchPages();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            // Redirect based on user role
            if (result.user?.role === 'viewer') {
                navigate('/view-semester');
            } else {
                navigate('/view');
            }
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleGuestSubmit = async (e) => {
        e.preventDefault();
        if (!guestName.trim() || !guestPage) {
            setError('Please provide your name and select a routine');
            return;
        }

        setError('');
        setLoading(true);

        const result = await guestLogin(guestName, parseInt(guestPage));

        if (result.success) {
            navigate('/view-semester');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 via-white to-secondary-50 p-4">
            <div className="glass-card max-w-md w-full p-8 rounded-2xl">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center text-white font-bold text-2xl mb-4">
                        R
                    </div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                        Login <span className="text-xs font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full ml-1">V2.0</span>
                    </h1>
                    <p className="text-slate-500">Sign in to access schedules</p>
                    <p className="text-slate-600">
                        Room Booking Management System
                    </p>
                </div>

                {/* Error Alert */}
                {error && (
                    <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 flex items-start gap-3">
                        <AlertCircle className="text-red-500 flex-shrink-0 mt-0.5" size={20} />
                        <p className="text-red-700 text-sm">{error}</p>
                    </div>
                )}

                {/* Login Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Email Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Email Address
                        </label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="input-field pl-10"
                                placeholder="admin@cse.edu"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Password Field */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                            Password
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="input-field pl-10"
                                placeholder="Enter your password"
                                required
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Submit Button */}
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full btn-primary py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                <span>Logging in...</span>
                            </>
                        ) : (
                            <>
                                <LogIn size={20} />
                                <span>Login</span>
                            </>
                        )}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="px-2 bg-white text-slate-500">or</span>
                    </div>
                </div>

                {/* Guest/Viewer Login Section */}
                {!showGuestForm ? (
                    <button
                        onClick={() => setShowGuestForm(true)}
                        className="w-full py-3 rounded-lg border-2 border-primary-300 text-primary-600 hover:bg-primary-50 transition-all flex items-center justify-center gap-2 font-medium"
                    >
                        <Eye size={20} />
                        <span>Continue as Viewer (Guest)</span>
                    </button>
                ) : (
                    <form onSubmit={handleGuestSubmit} className="space-y-4 p-4 border-2 border-primary-100 rounded-xl bg-primary-50/30 animate-in fade-in slide-in-from-top-2">
                        <h3 className="text-sm font-bold text-primary-700 uppercase tracking-wider flex items-center gap-2">
                            <User size={14} /> Guest Access
                        </h3>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">
                                Your Full Name
                            </label>
                            <input
                                type="text"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                                placeholder="e.g. John Doe"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">
                                Select Your Routine
                            </label>
                            <select
                                value={guestPage}
                                onChange={(e) => setGuestPage(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 bg-white"
                                required
                            >
                                <option value="">-- Choose Batch/Section --</option>
                                {semesterPages.map(page => (
                                    <option key={page.pageNumber} value={page.pageNumber}>
                                        {page.fullText || `Page ${page.pageNumber}`}
                                    </option>
                                ))}
                            </select>
                            {loadingPages && (
                                <p className="text-[10px] text-primary-600 mt-1 animate-pulse">Loading routines...</p>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => setShowGuestForm(false)}
                                className="flex-1 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-[2] btn-primary py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                            >
                                <span>Get Routine</span>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </form>
                )}
                {!showGuestForm && (
                    <p className="text-xs text-slate-500 text-center mt-2">
                        View semester schedules with personalized access
                    </p>
                )}

                {/* Default Credentials Info (Remove in production) */}
                <div className="mt-6 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-600 text-center">
                        <strong>Default credentials:</strong><br />
                        Email: admin@cse.edu<br />
                        Password: admin123
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminLogin;
