import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const PrivateRoute = ({ children }) => {
    const { user, isAuthenticated, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading...</p>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Redirect viewers to semester schedule if trying to access non-viewer routes
    const isViewer = user?.role === 'viewer';
    const viewerAllowedPaths = ['/view-semester', '/view-quiz', '/'];
    if (isViewer && !viewerAllowedPaths.includes(location.pathname)) {
        return <Navigate to="/view-semester" replace />;
    }

    return children;
};

export default PrivateRoute;
