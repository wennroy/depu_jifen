import { useState } from 'react';
import { Toast } from 'antd-mobile';
import { Play, FastForward } from 'lucide-react';
import http from '../../api/http';
import type { GamePhase } from '../../stores/gameStore';
import styles from './GameControlButton.module.css';

interface Props {
  roomCode: string;
  playerToken: string;
  phase: GamePhase;
  bettingComplete: boolean;
}

export default function GameControlButton({ roomCode, playerToken, phase, bettingComplete }: Props) {
  const [loading, setLoading] = useState(false);

  const handleStart = async () => {
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/start-hand`, {}, {
        headers: { 'X-User-Token': playerToken },
      });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const handleNextRound = async () => {
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/next-round`, {}, {
        headers: { 'X-User-Token': playerToken },
      });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  if (phase === 'lobby') {
    return (
      <button className={styles.startBtn} onClick={handleStart} disabled={loading}>
        <Play size={20} />
        <span>{loading ? '开始中...' : '开始游戏'}</span>
      </button>
    );
  }

  if (bettingComplete && phase !== 'showdown') {
    return (
      <button className={styles.nextBtn} onClick={handleNextRound} disabled={loading}>
        <FastForward size={18} />
        <span>{loading ? '推进中...' : '下一轮'}</span>
      </button>
    );
  }

  return null;
}
