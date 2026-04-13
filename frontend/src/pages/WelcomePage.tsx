import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toast, Dialog } from 'antd-mobile';
import { Spade } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import styles from './HomePage.module.css';
import formStyles from '../components/home/Forms.module.css';

export default function WelcomePage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, checkUsername } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const redirect = (location.state as any)?.from || '/';
  // Extract room code from /join/:roomCode path
  const joinMatch = typeof redirect === 'string' ? redirect.match(/^\/join\/([A-Za-z0-9]+)/) : null;
  const inviteRoomCode = joinMatch ? joinMatch[1].toUpperCase() : null;

  const doRegister = async () => {
    setLoading(true);
    try {
      await register(username.trim());
      navigate(redirect, { replace: true });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '创建失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      Toast.show({ content: '请输入昵称' });
      return;
    }
    setLoading(true);
    try {
      const exists = await checkUsername(username.trim());
      if (exists) {
        setLoading(false);
        const confirmed = await Dialog.confirm({
          title: '该用户名已存在',
          content: (
            <div style={{ textAlign: 'center' }}>
              <p>是否要以 <strong>{username.trim()}</strong> 的身份登录？</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 8 }}>
                我们是通过用户名来确认身份哦
              </p>
            </div>
          ),
          confirmText: '登录',
          cancelText: '取消',
        });
        if (confirmed) {
          await doRegister();
        }
        return;
      }
      await doRegister();
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '创建失败', icon: 'fail' });
      setLoading(false);
    }
  };

  return (
    <div className="felt-bg" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Spade className={styles.logoIcon} />
            <h1 className={styles.title}>
              <span className="gold-text">德扑记分</span>
            </h1>
          </div>
          <p className={styles.subtitle}>输入昵称登录或注册</p>
          {inviteRoomCode && (
            <p style={{ fontSize: '0.85rem', color: 'var(--color-accent)', marginTop: 8, fontWeight: 600 }}>
              你正在被邀请加入房间 #{inviteRoomCode}
            </p>
          )}
        </div>

        <div className={styles.formArea}>
          <form onSubmit={handleSubmit} className={formStyles.form}>
            <div className={formStyles.field}>
              <label className={formStyles.label}>你的昵称</label>
              <input
                className={formStyles.input}
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="输入你的昵称"
                maxLength={50}
                autoFocus
              />
            </div>
            <button className={formStyles.submitBtn} type="submit" disabled={loading}>
              {loading ? '登录中...' : '开始使用'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
