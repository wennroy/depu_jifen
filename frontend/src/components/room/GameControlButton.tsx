import { useState } from 'react';
import { Toast, Dialog } from 'antd-mobile';
import { Play, FastForward, Ban } from 'lucide-react';
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

  const handleAbort = async () => {
    const confirmed = await Dialog.confirm({
      content: '确定要终止本局吗？所有下注将退还给玩家。',
      confirmText: '终止',
      cancelText: '取消',
    });
    if (!confirmed) return;
    setLoading(true);
    try {
      await http.post(`/rooms/${roomCode}/abort-hand`, {}, {
        headers: { 'X-User-Token': playerToken },
      });
    } catch (err: any) {
      Toast.show({ content: err?.response?.data?.detail || '操作失败', icon: 'fail' });
    } finally {
      setLoading(false);
    }
  };

  const gameActive = phase !== 'lobby';

  if (phase === 'lobby') {
    return (
      <button className={styles.startBtn} onClick={handleStart} disabled={loading}>
        <Play size={20} />
        <span>{loading ? '开始中...' : '开始游戏'}</span>
      </button>
    );
  }

  return (
    <div className={styles.controlGroup}>
      {bettingComplete && phase !== 'showdown' && (
        <button className={styles.nextBtn} onClick={handleNextRound} disabled={loading}>
          <FastForward size={18} />
          <span>{loading ? '推进中...' : '下一轮'}</span>
        </button>
      )}
      {gameActive && (
        <button className={styles.abortBtn} onClick={handleAbort} disabled={loading}>
          <Ban size={16} />
          <span>终止对局</span>
        </button>
      )}
    </div>
  );
}
