import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Spade } from 'lucide-react';
import CreateRoomForm from '../components/home/CreateRoomForm';
import JoinRoomForm from '../components/home/JoinRoomForm';
import styles from './HomePage.module.css';

export default function HomePage() {
  const { roomCode } = useParams<{ roomCode?: string }>();
  const [activeTab, setActiveTab] = useState<'create' | 'join'>(roomCode ? 'join' : 'create');

  return (
    <div className="felt-bg" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div className={styles.container}>
        <div className={styles.header}>
          <div className={styles.logo}>
            <Spade className={styles.logoIcon} />
            <h1 className={styles.title}>
              <span className="gold-text">德扑记分</span>
            </h1>
          </div>
          <p className={styles.subtitle}>朋友局筹码管理工具</p>
        </div>

        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'create' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('create')}
          >
            创建房间
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'join' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('join')}
          >
            加入房间
          </button>
        </div>

        <div className={styles.formArea}>
          {activeTab === 'create' ? <CreateRoomForm /> : <JoinRoomForm defaultCode={roomCode} />}
        </div>
      </div>
    </div>
  );
}
