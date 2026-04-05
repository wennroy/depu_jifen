import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import http from '../api/http';

interface UserInfo {
  userId: string;
  username: string;
  userToken: string;
}

interface UserContextType {
  user: UserInfo | null;
  loading: boolean;
  register: (username: string) => Promise<void>;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null, loading: true, register: async () => {}, logout: () => {},
});

export function useUser() {
  return useContext(UserContext);
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('depu_user_token');
    if (!token) {
      setLoading(false);
      return;
    }
    // Verify token is still valid
    http.get('/users/me', { headers: { 'X-User-Token': token } })
      .then(({ data }) => {
        setUser({ userId: data.user_id, username: data.username, userToken: data.user_token });
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem('depu_user_token');
        setLoading(false);
      });
  }, []);

  const register = async (username: string) => {
    const { data } = await http.post('/users', { username: username.trim() });
    const info: UserInfo = { userId: data.user_id, username: data.username, userToken: data.user_token };
    localStorage.setItem('depu_user_token', info.userToken);
    setUser(info);
  };

  const logout = () => {
    localStorage.removeItem('depu_user_token');
    setUser(null);
  };

  return (
    <UserContext.Provider value={{ user, loading, register, logout }}>
      {children}
    </UserContext.Provider>
  );
}
