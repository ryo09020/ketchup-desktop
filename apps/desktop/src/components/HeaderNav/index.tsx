import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Timer,
  CheckSquare,
  FileText,
  Users,
  BarChart2,
  Settings,
  Sun,
  Moon,
  Minimize2,
} from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { useAuth } from '@/providers/AuthProvider';
import { useTimer } from '@/providers/TimerProvider';

export const HeaderNav: React.FC = () => {
  const { profile } = useAuth();
  const { toggleMiniMode } = useTimer();
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'light';
  });

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('theme', nextTheme);
  };

  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <header className={classes.header}>
      <div className={classes.leftSection}>
        <NavLink to="/" className={classes.logo}>
          <img src={tomatoSvg} alt="KetchUp Tomato" className={classes.logoIcon} />
          <span>KetchUp</span>
        </NavLink>

        <nav className={classes.navLinks}>
          <NavLink to="/" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.active : ''}`}>
            <Timer size={18} />
            <span>タイマー</span>
          </NavLink>
          <NavLink to="/tasks" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.active : ''}`}>
            <CheckSquare size={18} />
            <span>タスク</span>
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.active : ''}`}>
            <FileText size={18} />
            <span>日報</span>
          </NavLink>
          <NavLink to="/stats" className={({ isActive }) => `${classes.navLink} ${isActive ? classes.active : ''}`}>
            <BarChart2 size={18} />
            <span>統計</span>
          </NavLink>
        </nav>
      </div>

      <div className={classes.rightSection}>
        <button
          className={classes.themeButton}
          onClick={toggleMiniMode}
          title="ミニタイマーモード (画面隅に最前面フロート)"
        >
          <Minimize2 size={18} />
        </button>

        <button className={classes.themeButton} onClick={toggleTheme} title="テーマ切り替え">
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        <NavLink to="/settings" className={classes.themeButton} title="設定">
          <Settings size={18} />
        </NavLink>

        <div className={classes.userInfo}>
          <div className={classes.avatar}>
            {profile?.displayName?.charAt(0) || 'K'}
          </div>
          <span>{profile?.displayName || 'Ketchup User'}</span>
        </div>
      </div>
    </header>
  );
};
