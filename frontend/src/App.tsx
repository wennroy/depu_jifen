import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
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
  const { user } = useUser();
  const navigate = useNavigate();
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    if (!user || !roomCode || joining) return;
    setJoining(true);
    import('./api/http').then(({ default: http }) => {
      http.post(`/rooms/${roomCode.toUpperCase()}/join`, {}, {
        headers: { 'X-User-Token': user.userToken },
      }).then(() => {
        navigate(`/room/${roomCode}`, { replace: true });
      }).catch(() => {
        navigate(`/room/${roomCode}`, { replace: true });
      });
    });
  }, [user, roomCode]);

  return null;
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
