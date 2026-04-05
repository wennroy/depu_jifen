import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Toast } from 'antd-mobile';
import { Spade } from 'lucide-react';
import { useUser } from '../contexts/UserContext';
import styles from './HomePage.module.css';
import formStyles from '../components/home/Forms.module.css';

export default function WelcomePage() {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useUser();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      Toast.show({ content: '请输入昵称' });
      return;
    }
    setLoading(true);
    try {
      await register(username.trim());
      const redirect = (location.state as any)?.from || '/';
      navigate(redirect, { replace: true });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '创建失败', icon: 'fail' });
    } finally {
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
          <p className={styles.subtitle}>输入昵称开始使用</p>
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
              {loading ? '创建中...' : '开始使用'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
