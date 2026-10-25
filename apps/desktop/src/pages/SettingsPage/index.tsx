import React, { useState } from 'react';
import classes from './index.module.scss';
import googleLogo from '@/assets/google-logo.svg';
import tomatoSvg from '@/assets/tomato.svg';
import { useAuth } from '@/providers/AuthProvider';
import { useTranslation, Language } from '@/providers/LanguageProvider';
import { api } from '@/api/client';
import { Settings, User, FileText, Info, AlertTriangle, FolderOpen, Globe } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export const SettingsPage: React.FC = () => {
  const { user, profile, signInWithGoogle, signOut } = useAuth();
  const { t, language, setLanguage } = useTranslation();
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
    const confirmMsg =
      language === 'ja'
        ? '本当にデータを初期化しますか？\n作成したタスク、ポモドーロ履歴、日報等のすべてのデータが完全に削除され、復元できなくなります。'
        : 'Are you sure you want to clear all data?\nAll tasks, pomodoro history, and reports will be permanently deleted.';
    if (!window.confirm(confirmMsg)) return;

    const promptMsg =
      language === 'ja'
        ? '確認のため「DELETE」と入力してください:'
        : 'Please type "DELETE" to confirm:';
    if (window.prompt(promptMsg) !== 'DELETE') {
      alert(language === 'ja' ? 'キャンセルしました。' : 'Cancelled.');
      return;
    }

    setIsDeleting(true);
    try {
      await api.deleteMe();
      await signOut();
      alert(language === 'ja' ? '全データが初期化されました。' : 'All data has been cleared.');
      window.location.href = '/';
    } catch (err) {
      console.error('Failed to delete account:', err);
      alert(language === 'ja' ? '削除に失敗しました。' : 'Failed to delete data.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className={classes.container}>
      <h1 className={classes.title}>
        <Settings size={24} />
        <span>{t('settings.title')}</span>
      </h1>

      {/* Language Settings */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Globe size={18} />
          <span>{t('settings.languageSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.languageLabel')}</div>
            <div className={classes.desc}>{t('settings.languageDesc')}</div>
          </div>
          <div>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as Language)}
              className={classes.selectDropdown}
            >
              <option value="ja">日本語 (Japanese)</option>
              <option value="en">English (US)</option>
            </select>
          </div>
        </div>
      </section>

      {/* Account Section */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <User size={18} />
          <span>{t('settings.accountSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.googleSso')}</div>
            <div className={classes.desc}>
              {user
                ? t('settings.loggedAs', { email: profile?.email || user.email || '' })
                : t('settings.notLogged')}
            </div>
          </div>
          <div>
            {user ? (
              <button className={classes.googleBtn} onClick={signOut}>
                {t('settings.logout')}
              </button>
            ) : (
              <button className={classes.googleBtn} onClick={signInWithGoogle}>
                <img src={googleLogo} alt="Google" width={18} height={18} />
                <span>{t('settings.loginGoogle')}</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Timer Section */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
          <span>{t('settings.timerSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.focusDuration')}</div>
            <div className={classes.desc}>{t('settings.focusDurationDesc')}</div>
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
            <div className={classes.label}>{t('settings.shortBreak')}</div>
            <div className={classes.desc}>{t('settings.shortBreakDesc')}</div>
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
            <div className={classes.label}>{t('settings.longBreak')}</div>
            <div className={classes.desc}>{t('settings.longBreakDesc')}</div>
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
            <div className={classes.label}>{t('settings.pomoCalc')}</div>
            <div className={classes.desc}>{t('settings.pomoCalcDesc')}</div>
          </div>
          <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>1 pomo = 25m</span>
        </div>
      </section>

      {/* Obsidian Vault */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <FileText size={18} />
          <span>{t('settings.obsidianSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.obsidianVaultFolder')}</div>
            <div className={classes.desc}>{t('settings.obsidianVaultDesc')}</div>
            <div className={classes.desc} style={{ marginTop: 4, color: 'var(--color-primary)' }}>
              {t('settings.obsidianDestination', { path: obsidianVaultPath })}
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
              title={t('settings.selectFolder')}
            >
              <FolderOpen size={14} />
              <span>{t('settings.selectFolder')}</span>
            </button>
          </div>
        </div>
      </section>

      {/* App Info */}
      <section className={classes.section}>
        <div className={classes.sectionTitle}>
          <Info size={18} />
          <span>{t('settings.appInfoSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.appName')}</div>
            <div className={classes.desc} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span>KetchUp Desktop</span>
              <img src={tomatoSvg} alt="Tomato" className={classes.tomatoIcon} />
            </div>
          </div>
          <span style={{ fontWeight: 600 }}>v0.1.0</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.bundleId')}</div>
            <div className={classes.desc}>{t('settings.bundleIdDesc')}</div>
          </div>
          <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            io.github.ryo09020.ketchup
          </span>
        </div>
      </section>

      {/* Danger Zone */}
      <section className={classes.section} style={{ borderColor: '#fca5a5' }}>
        <div className={classes.sectionTitle} style={{ color: '#ef4444' }}>
          <AlertTriangle size={18} />
          <span>{t('settings.dangerSection')}</span>
        </div>
        <div className={classes.row}>
          <div>
            <div className={classes.label}>{t('settings.deleteAccount')}</div>
            <div className={classes.desc}>{t('settings.deleteAccountDesc')}</div>
          </div>
          <button
            className={classes.deleteBtn}
            onClick={handleDeleteAccount}
            disabled={isDeleting}
          >
            {isDeleting ? t('settings.deleting') : t('settings.deleteBtn')}
          </button>
        </div>
      </section>
    </div>
  );
};
