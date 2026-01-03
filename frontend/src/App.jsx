import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import AdminLogin from './pages/AdminLogin';
import UploadSchedule from './pages/UploadSchedule';
import ViewSchedule from './pages/ViewSchedule';
import ViewSemesterSchedule from './pages/ViewSemesterSchedule';
import ViewQuizSchedule from './pages/ViewQuizSchedule';
import BookRoom from './pages/BookRoom';
import QuizBooking from './pages/QuizBooking';
import { Calendar, LayoutDashboard, Upload, ClipboardList, LogOut, User } from 'lucide-react';

const NavLink = ({ to, icon: Icon, label }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${isActive
          ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        }`}
    >
      <Icon size={18} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

const Navigation = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  // Don't show navigation on login page
  if (location.pathname === '/login') {
    return null;
  }

  const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
  const isViewer = user?.role === 'viewer';

  return (
    <nav className="bg-white shadow-sm border-b border-slate-200 mb-8 sticky top-0 z-10">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="text-xl font-bold text-primary-600">
          Room Booking System
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            {isViewer ? (
              <>
                <NavLink to="/view-semester" icon={Calendar} label="Semester Schedule" />
                <NavLink to="/view-quiz" icon={ClipboardList} label="Quiz Schedule" />
              </>
            ) : (
              <>
                <NavLink to="/" icon={LayoutDashboard} label="Routine" />
                <NavLink to="/quiz" icon={ClipboardList} label="Quiz Rooms" />
                <NavLink to="/view-quiz" icon={ClipboardList} label="Quiz Schedule" />
                <NavLink to="/book" icon={Calendar} label="Book Room" />
                {isAdmin && <NavLink to="/upload" icon={Upload} label="Upload" />}
              </>
            )}
          </div>

          {user && (
            <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100">
                <User size={16} className="text-slate-600" />
                <span className="text-sm font-medium text-slate-700">{user.name}</span>
                <span className="text-xs text-slate-500">({user.role?.toUpperCase()})</span>
              </div>
              <button
                onClick={logout}
                className="p-2 rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
                title="Logout"
              >
                <LogOut size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <Navigation />
      <main className="container mx-auto px-4">
        <Routes>
          <Route path="/login" element={<AdminLogin />} />
          <Route path="/" element={
            <PrivateRoute>
              <Navigate to="/view" replace />
            </PrivateRoute>
          } />
          <Route path="/view" element={
            <PrivateRoute>
              <ViewSchedule />
            </PrivateRoute>
          } />
          <Route path="/view-semester" element={
            <PrivateRoute>
              <ViewSemesterSchedule />
            </PrivateRoute>
          } />
          <Route path="/view-quiz" element={
            <PrivateRoute>
              <ViewQuizSchedule />
            </PrivateRoute>
          } />
          <Route path="/quiz" element={
            <PrivateRoute>
              <QuizBooking />
            </PrivateRoute>
          } />
          <Route path="/book" element={
            <PrivateRoute>
              <BookRoom />
            </PrivateRoute>
          } />
          <Route path="/upload" element={
            <PrivateRoute>
              <UploadSchedule />
            </PrivateRoute>
          } />
        </Routes>
      </main>
    </div>
  );
}

export default App;
