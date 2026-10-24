import React, { useState } from 'react';
import useSWR from 'swr';
import { Users, Plus, LogIn } from 'lucide-react';
import classes from './index.module.scss';
import tomatoSvg from '@/assets/tomato.svg';
import { api, Group, GroupMember } from '@/api/client';

export const GroupPage: React.FC = () => {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const { data: groups, mutate: mutateGroups } = useSWR('groups', () => api.listGroups(), {
    revalidateOnFocus: false,
  });

  const { data: members } = useSWR(
    selectedGroupId ? `group-members-${selectedGroupId}` : null,
    () => api.listGroupMembers(selectedGroupId!),
    { refreshInterval: 5000 }
  );

  const handleCreateGroup = async () => {
    const name = prompt('作成するグループ名を入力してください:');
    if (!name?.trim()) return;
    const desc = prompt('グループの説明 (任意):') || '';

    try {
      const g = await api.createGroup(name.trim(), desc.trim());
      await mutateGroups();
      setSelectedGroupId(g.id);
    } catch (err) {
      console.error('Failed to create group:', err);
    }
  };

  const handleJoinGroup = async () => {
    const code = prompt('8文字の招待コードを入力してください:');
    if (!code?.trim()) return;

    try {
      const g = await api.joinGroup(code.trim());
      await mutateGroups();
      setSelectedGroupId(g.id);
    } catch (err) {
      console.error('Failed to join group:', err);
      alert('無効な招待コードです。');
    }
  };

  const activeGroup = groups?.find((g) => g.id === selectedGroupId) || (groups && groups[0]);

  return (
    <div className={classes.container}>
      <div className={classes.headerRow}>
        <h1 className={classes.title}>
          <Users size={22} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle', color: 'var(--color-primary)' }} />
          <span>グループ & メンバータイマー</span>
        </h1>
        <div className={classes.actions}>
          <button className={`${classes.btn} ${classes.primary}`} onClick={handleCreateGroup}>
            <Plus size={16} />
            <span>グループ作成</span>
          </button>
          <button className={`${classes.btn} ${classes.secondary}`} onClick={handleJoinGroup}>
            <LogIn size={16} />
            <span>招待コードで参加</span>
          </button>
        </div>
      </div>

      <div className={classes.groupGrid}>
        {groups && groups.length > 0 ? (
          groups.map((g) => (
            <div
              key={g.id}
              className={`${classes.groupCard} ${activeGroup?.id === g.id ? classes.selected : ''}`}
              onClick={() => setSelectedGroupId(g.id)}
            >
              <div className={classes.cardTitle}>{g.name}</div>
              <div className={classes.cardDesc}>{g.description || '説明なし'}</div>
              <div className={classes.cardMeta}>
                <span>メンバー: {g.memberCount}名</span>
                <span>招待コード: {g.inviteCode}</span>
              </div>
            </div>
          ))
        ) : (
          <div style={{ color: 'var(--color-text-muted)' }}>
            まだグループがありません。「グループ作成」または「招待コードで参加」してください。
          </div>
        )}
      </div>

      {activeGroup && (
        <section className={classes.memberSection}>
          <div className={classes.memberTitle}>
            <span>{activeGroup.name} のメンバー稼働状況 (リアルタイム)</span>
            <div className={classes.inviteBadge}>
              招待コード: {activeGroup.inviteCode}
            </div>
          </div>

          <div className={classes.memberList}>
            {members && members.length > 0 ? (
              members.map((m) => {
                const phase = m.session?.phase || 'IDLE';
                const taskTitle = m.session?.taskTitle;

                return (
                  <div key={m.userId} className={classes.memberItem}>
                    <div className={classes.memberUser}>
                      <div className={classes.avatar}>
                        {m.displayName?.charAt(0) || 'M'}
                      </div>
                      <div>
                        <div className={classes.name}>{m.displayName}</div>
                        {taskTitle && (
                          <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            作業中: {taskTitle}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className={classes.memberSession}>
                      {phase === 'FOCUS' && (
                        <span className={`${classes.statusTag} ${classes.focus}`}>
                          <img src={tomatoSvg} alt="pomo" style={{ width: 12, height: 12, imageRendering: 'pixelated', verticalAlign: 'middle', marginRight: 4 }} />
                          集中中
                        </span>
                      )}
                      {(phase === 'SHORT_BREAK' || phase === 'LONG_BREAK') && (
                        <span className={`${classes.statusTag} ${classes.break}`}>
                          休憩中
                        </span>
                      )}
                      {phase === 'PAUSED' && (
                        <span className={`${classes.statusTag} ${classes.idle}`}>
                          一時停止
                        </span>
                      )}
                      {phase === 'IDLE' && (
                        <span className={`${classes.statusTag} ${classes.idle}`}>
                          待機中
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)' }}>
                メンバー情報を読み込み中...
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
};
