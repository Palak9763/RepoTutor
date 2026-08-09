import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AuthPage from './components/AuthPage';
import Dashboard from './components/Dashboard';
import AnalyticsPage from './pages/AnalyticsPage';
import ChatPage from './pages/ChatPage';
import { supabase } from './lib/supabase';
import { Loader2, Code2 } from 'lucide-react';

function ProtectedRoute({ children, session }: { children: React.ReactNode; session: any }) {
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes({ session, setSession }: { session: any; setSession: (s: any) => void }) {
  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthSuccess={() => {}} />}
      />
      <Route
        path="/signup"
        element={session ? <Navigate to="/dashboard" replace /> : <AuthPage onAuthSuccess={() => {}} />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute session={session}>
            <Dashboard onSignOut={() => setSession(null)} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute session={session}>
            <Dashboard onSignOut={() => setSession(null)} />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/analytics"
        element={
          <ProtectedRoute session={session}>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:id/chat"
        element={
          <ProtectedRoute session={session}>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="*"
        element={<Navigate to={session ? "/dashboard" : "/login"} replace />}
      />
    </Routes>
  );
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: 44, height: 44, background: '#111', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Code2 size={20} color="white" />
          </div>
          <Loader2 size={20} style={{ color: '#7c3aed', animation: 'spin 1s linear infinite', margin: '0 auto' }} />
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppRoutes session={session} setSession={setSession} />
    </BrowserRouter>
  );
}

export default App;
