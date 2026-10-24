import React, { useState } from 'react';
import classes from './index.module.scss';
import googleLogo from '@/assets/google-logo.svg';
import tomatoSvg from '@/assets/tomato.svg';
import { useAuth } from '@/providers/AuthProvider';
import { api } from '@/api/client';
import { Settings, User, FileText, Info, AlertTriangle, FolderOpen } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const SettingsPage: React.FC = () => {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const [focusMin, setFocusMin] = useState(25);
  const [shortBreakMin, setShortBreakMin] = useState(5);
  const [longBreakMin, setLongBreakMin] = useState(15);
  const [isDeleting, setIsDeleting] = useState(false);
  const [obsidianVaultPath, setObsidianVaultPath] = useState<string>(() => {
    const saved = localStorage.getItem('ketchup_obsidian_vault_path');
    if (!saved || saved === '~/Documents/Obsidian/Daily') {
      return '~/Documents/Obsidian Vault';
    }
    return saved;
  });

  const handleSelectFolder = async () => {
    try {
      const selected = await invoke<string | null>('select_obsidian_folder');
      if (selected) {
        setObsidianVaultPath(selected);
        localStorage.setItem('ketchup_obsidian_vault_path', selected);
      }
    } catch (err) {
      console.error('Failed to select folder:', err);
    }
  };

  const handleDeleteAccount = async () => {
    const confirm1 = window.confirm(
      '本当にアカウントを削除しますか？\n作成したタスク、ポモドーロ履歴、日報、グループ所属等のすべてのデータが完全に削除され、復元できなくなります。'
    );
    if (!confirm1) return;

    const confirm2 = window.prompt(
      '確認のため「DELETE」と入力してください:'
    );
    if (confirm2 !== 'DELETE') {
      alert('入力が一致しないためキャンセルしました。');
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteMe();
      await signOut();
      alert('アカウントと全データが完全に削除されました。');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert('削除に失敗しました。');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>
        <Settings size={24} />
        <span>アプリ & アカウント設定</span>
      </h1>

      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <User size={18} />
          <span>アカウント & 認証</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>Google アカウント連携 (SSO)</div>
            <div className={classes.desc}>
              {user ? `ログイン中: ${profile?.email || user.email}` : 'ログインしていません'}
            </div>
          </div>
          <div>
            {user ? (
              <button className={classes.googleBtn} onClick={signOut}>
                ログアウト
              </button>
            ) : (
              <button className={classes.googleBtn} onClick={signInWithGoogle}>
                <img src={googleLogo} alt="Google" width={18} height={18} />
                <span>Google でログイン</span>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
          <span>タイマー設定 & 集中ターム</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>1セッションの集中時間 (分)</div>
            <div className={classes.desc}>タイマーの1ターム分数 (前回設定した値が自動で保持されます)</div>
          </div>
          <input
            type="number"
            min="1"
            max="180"
            className={classes.inputNumber}
            value={focusMin}
            onChange={(e) => {
              const val = Number(e.target.value);
              setFocusMin(val);
              localStorage.setItem('ketchup_last_term_sec', (val * 60).toString());
            }}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>短い休憩 (分)</div>
            <div className={classes.desc}>集中ターム後の標準休憩 (デフォルト: 5分)</div>
          </div>
          <input
            type="number"
            min="1"
            max="30"
            className={classes.inputNumber}
            value={shortBreakMin}
            onChange={(e) => setShortBreakMin(Number(e.target.value))}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>長い休憩 (分)</div>
            <div className={classes.desc}>4ターム消化後の大休憩 (デフォルト: 15分)</div>
          </div>
          <input
            type="number"
            min="1"
            max="60"
            className={classes.inputNumber}
            value={longBreakMin}
            onChange={(e) => setLongBreakMin(Number(e.target.value))}
          />
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>ポモドーロ換算基準</div>
            <div className={classes.desc}>
              1pomo = 累計25分作業（1分×25回でも、25分×1回でも25分作業で1pomoとして正確に集計）
            </div>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>1 pomo = 25分</span>
        </div>
      </section>

      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <FileText size={18} />
          <span>Obsidian 連携設定</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>Obsidian Vault 保存先フォルダ</div>
            <div className={classes.desc}>
              日報はこの Vault の中の「<strong>daily_report</strong>」フォルダに自動保存されます（未作成なら自動作成）
            </div>
            <div className={classes.desc} style={{ marginTop: 4, color: 'var(--color-primary)' }}>
              保存先: {obsidianVaultPath}/daily_report/YYYY-MM-DD.md
            </div>
          </div>
          <div className={classes.pathInputWrapper}>
            <input
              type="text"
              className={classes.inputText}
              placeholder="~/Documents/Obsidian Vault"
              value={obsidianVaultPath}
              onChange={(e) => {
                setObsidianVaultPath(e.target.value);
                localStorage.setItem('ketchup_obsidian_vault_path', e.target.value);
              }}
            />
            <button
              type="button"
              className={classes.selectFolderBtn}
              onClick={handleSelectFolder}
              title="Finderからフォルダを選択"
            >
              <FolderOpen size={14} />
              <span>フォルダ選択</span>
            </button>
          </div>
        </div>
      </section>

      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Info size={18} />
          <span>アプリ情報</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>アプリケーション名</div>
            <div className={classes.desc} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>KetchUp Desktop</span>
              <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
            </div>
          </div>
          <span style={{ fontWeight: 600 }}>v0.1.0</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>Bundle ID</div>
            <div className={classes.desc}>Mac App Store 識別子</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            io.github.ryo09020.ketchup
          </span>
        </div>
      </section>

      <section className={classes.section} style={{ borderColor: '#fca5a5' }}>
        <div className={classes.sectionTitle} style={{ color: '#ef4444' }}>
          <AlertTriangle size={18} />
          <span>危険な操作 (App Store ガイドライン 5.1.1(v) 準拠)</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>アカウントと全データの削除</div>
            <div className={classes.desc}>
              タスク、ポモドーロ記録、日報、所属グループを含むすべてのユーザーデータを物理削除します。
            </div>
          </div>
          <button
            className={classes.deleteBtn}
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? '削除中...' : 'アカウントを削除'}
          </button>
        </div>
      </section>
    </div>
  );
};
