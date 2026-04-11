import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { UserProvider, useUser } from './contexts/UserContext';
import WelcomePage from './pages/WelcomePage';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import './styles/global.css';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useUser();
  const location = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/welcome" state={{ from: location.pathname }} replace />;
  return <>{children}</>;
}

function JoinRedirect() {
  const { roomCode } = useParams();
  return <Navigate to={`/room/${roomCode}`} replace />;
}

export default function App() {
  return (
    <UserProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
          <Route path="/room/:roomCode" element={<RequireAuth><RoomPage /></RequireAuth>} />
          <Route path="/join/:roomCode" element={<RequireAuth><JoinRedirect /></RequireAuth>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </UserProvider>
  );
}
