package store

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/ryo09020/ketchup-desktop/server/internal/models"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(ctx context.Context, connString string) (*PostgresStore, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to postgres: %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}
	return &PostgresStore{pool: pool}, nil
}

func (s *PostgresStore) GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, email, display_name, coalesce(avatar_url, ''), timezone, created_at, updated_at
		FROM public.profiles WHERE id = $1
	`, userID)
	var p models.Profile
	if err := row.Scan(&p.ID, &p.Email, &p.DisplayName, &p.AvatarURL, &p.Timezone, &p.CreatedAt, &p.UpdatedAt); err != nil {
		return nil, err
	}
	return &p, nil
}

func (s *PostgresStore) UpsertProfile(ctx context.Context, p *models.Profile) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.profiles (id, email, display_name, avatar_url, timezone)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (id) DO UPDATE SET
			display_name = coalesce(excluded.display_name, profiles.display_name),
			avatar_url = coalesce(excluded.avatar_url, profiles.avatar_url),
			timezone = coalesce(excluded.timezone, profiles.timezone),
			updated_at = now()
	`, p.ID, p.Email, p.DisplayName, p.AvatarURL, p.Timezone)
	return err
}

func (s *PostgresStore) GetUserSettings(ctx context.Context, userID uuid.UUID) (*models.UserSettings, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT user_id, focus_sec, short_break_sec, long_break_sec, long_break_interval, auto_start_breaks, auto_start_focus, updated_at
		FROM public.user_settings WHERE user_id = $1
	`, userID)
	var set models.UserSettings
	if err := row.Scan(&set.UserID, &set.FocusSec, &set.ShortBreakSec, &set.LongBreakSec, &set.LongBreakInterval, &set.AutoStartBreaks, &set.AutoStartFocus, &set.UpdatedAt); err != nil {
		return nil, err
	}
	return &set, nil
}

func (s *PostgresStore) UpsertUserSettings(ctx context.Context, set *models.UserSettings) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.user_settings (user_id, focus_sec, short_break_sec, long_break_sec, long_break_interval, auto_start_breaks, auto_start_focus)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id) DO UPDATE SET
			focus_sec = excluded.focus_sec,
			short_break_sec = excluded.short_break_sec,
			long_break_sec = excluded.long_break_sec,
			long_break_interval = excluded.long_break_interval,
			auto_start_breaks = excluded.auto_start_breaks,
			auto_start_focus = excluded.auto_start_focus,
			updated_at = now()
	`, set.UserID, set.FocusSec, set.ShortBreakSec, set.LongBreakSec, set.LongBreakInterval, set.AutoStartBreaks, set.AutoStartFocus)
	return err
}

func (s *PostgresStore) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM auth.users WHERE id = $1`, userID)
	if err != nil {
		// Fallback to deleting from public.profiles
		_, err = s.pool.Exec(ctx, `DELETE FROM public.profiles WHERE id = $1`, userID)
	}
	return err
}

func (s *PostgresStore) ListTasks(ctx context.Context, userID uuid.UUID, status *models.TaskStatus, project *string) ([]models.Task, error) {
	query := `
		SELECT t.id, t.user_id, t.title, t.note, t.status, t.estimated_pomos,
		       coalesce(count(p.id), 0) as pomo_count,
		       t.due_date::text, t.project, t.sort_order, t.completed_at, t.created_at, t.updated_at
		FROM public.tasks t
		LEFT JOIN public.pomos p ON p.task_id = t.id
		WHERE t.user_id = $1
	`
	args := []interface{}{userID}
	if status != nil {
		args = append(args, *status)
		query += fmt.Sprintf(" AND t.status = $%d", len(args))
	}
	if project != nil {
		args = append(args, *project)
		query += fmt.Sprintf(" AND t.project = $%d", len(args))
	}
	query += ` GROUP BY t.id ORDER BY t.sort_order ASC`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tasks []models.Task
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.UserID, &t.Title, &t.Note, &t.Status, &t.EstimatedPomos, &t.PomoCount, &t.DueDate, &t.Project, &t.SortOrder, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	return tasks, nil
}

func (s *PostgresStore) GetTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) (*models.Task, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT t.id, t.user_id, t.title, t.note, t.status, t.estimated_pomos,
		       coalesce(count(p.id), 0) as pomo_count,
		       t.due_date::text, t.project, t.sort_order, t.completed_at, t.created_at, t.updated_at
		FROM public.tasks t
		LEFT JOIN public.pomos p ON p.task_id = t.id
		WHERE t.id = $1 AND t.user_id = $2
		GROUP BY t.id
	`, taskID, userID)
	var t models.Task
	if err := row.Scan(&t.ID, &t.UserID, &t.Title, &t.Note, &t.Status, &t.EstimatedPomos, &t.PomoCount, &t.DueDate, &t.Project, &t.SortOrder, &t.CompletedAt, &t.CreatedAt, &t.UpdatedAt); err != nil {
		return nil, err
	}
	return &t, nil
}

func (s *PostgresStore) CreateTask(ctx context.Context, task *models.Task) error {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO public.tasks (user_id, title, note, status, estimated_pomos, due_date, project, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6::date, $7, $8)
		RETURNING id, created_at, updated_at
	`, task.UserID, task.Title, task.Note, task.Status, task.EstimatedPomos, task.DueDate, task.Project, task.SortOrder)
	return row.Scan(&task.ID, &task.CreatedAt, &task.UpdatedAt)
}

func (s *PostgresStore) UpdateTask(ctx context.Context, task *models.Task) error {
	_, err := s.pool.Exec(ctx, `
		UPDATE public.tasks SET
			title = $1, note = $2, status = $3, estimated_pomos = $4,
			due_date = $5::date, project = $6, sort_order = $7,
			completed_at = $8, updated_at = now()
		WHERE id = $9 AND user_id = $10
	`, task.Title, task.Note, task.Status, task.EstimatedPomos, task.DueDate, task.Project, task.SortOrder, task.CompletedAt, task.ID, task.UserID)
	return err
}

func (s *PostgresStore) DeleteTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.tasks WHERE id = $1 AND user_id = $2`, taskID, userID)
	return err
}

func (s *PostgresStore) RecordPomo(ctx context.Context, pomo *models.Pomo) error {
	mins := pomo.DurationSec / 60
	if mins == 0 {
		pomo.PomoCount = 0
	} else {
		pomo.PomoCount = (mins + 24) / 25
	}

	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.pomos (user_id, task_id, client_id, started_at, ended_at, duration_sec, pomo_count)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (user_id, client_id) DO NOTHING
	`, pomo.UserID, pomo.TaskID, pomo.ClientID, pomo.StartedAt, pomo.EndedAt, pomo.DurationSec, pomo.PomoCount)
	if err != nil {
		return err
	}

	if pomo.TaskID != nil {
		_, _ = s.pool.Exec(ctx, `
			UPDATE public.tasks
			SET actual_focus_sec = actual_focus_sec + $1,
			    pomo_count = CASE WHEN (actual_focus_sec + $1) < 60 THEN 0 ELSE ((actual_focus_sec + $1) / 60 + 24) / 25 END,
			    updated_at = now()
			WHERE id = $2
		`, pomo.DurationSec, *pomo.TaskID)
	}

	return nil
}

func (s *PostgresStore) ListPomos(ctx context.Context, userID uuid.UUID, since time.Time) ([]models.Pomo, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, user_id, task_id, client_id, started_at, ended_at, duration_sec, pomo_count, created_at
		FROM public.pomos
		WHERE user_id = $1 AND started_at >= $2
		ORDER BY started_at ASC
	`, userID, since)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var pomos []models.Pomo
	for rows.Next() {
		var p models.Pomo
		if err := rows.Scan(&p.ID, &p.UserID, &p.TaskID, &p.ClientID, &p.StartedAt, &p.EndedAt, &p.DurationSec, &p.PomoCount, &p.CreatedAt); err != nil {
			return nil, err
		}
		pomos = append(pomos, p)
	}
	return pomos, nil
}

func (s *PostgresStore) GetSession(ctx context.Context, userID uuid.UUID) (*models.PomoSession, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT user_id, phase, task_id, task_title, phase_ends_at, remaining_sec, updated_at
		FROM public.pomo_sessions WHERE user_id = $1
	`, userID)
	var ps models.PomoSession
	if err := row.Scan(&ps.UserID, &ps.Phase, &ps.TaskID, &ps.TaskTitle, &ps.PhaseEndsAt, &ps.RemainingSec, &ps.UpdatedAt); err != nil {
		return &models.PomoSession{
			UserID:    userID,
			Phase:     models.SessionPhaseIdle,
			UpdatedAt: time.Now(),
		}, nil
	}
	return &ps, nil
}

func (s *PostgresStore) UpdateSession(ctx context.Context, sess *models.PomoSession) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.pomo_sessions (user_id, phase, task_id, task_title, phase_ends_at, remaining_sec, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, now())
		ON CONFLICT (user_id) DO UPDATE SET
			phase = excluded.phase,
			task_id = excluded.task_id,
			task_title = excluded.task_title,
			phase_ends_at = excluded.phase_ends_at,
			remaining_sec = excluded.remaining_sec,
			updated_at = now()
	`, sess.UserID, sess.Phase, sess.TaskID, sess.TaskTitle, sess.PhaseEndsAt, sess.RemainingSec)
	return err
}

func (s *PostgresStore) ListReports(ctx context.Context, userID uuid.UUID, limit int) ([]models.Report, error) {
	query := `
		SELECT id, user_id, published_date::text, body, self_score, source, created_at, updated_at
		FROM public.reports WHERE user_id = $1
		ORDER BY published_date DESC
	`
	if limit > 0 {
		query += fmt.Sprintf(" LIMIT %d", limit)
	}
	rows, err := s.pool.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []models.Report
	for rows.Next() {
		var r models.Report
		if err := rows.Scan(&r.ID, &r.UserID, &r.PublishedDate, &r.Body, &r.SelfScore, &r.Source, &r.CreatedAt, &r.UpdatedAt); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}

func (s *PostgresStore) GetReportByDate(ctx context.Context, userID uuid.UUID, date string) (*models.Report, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, user_id, published_date::text, body, self_score, source, created_at, updated_at
		FROM public.reports WHERE user_id = $1 AND published_date = $2::date
	`, userID, date)
	var r models.Report
	if err := row.Scan(&r.ID, &r.UserID, &r.PublishedDate, &r.Body, &r.SelfScore, &r.Source, &r.CreatedAt, &r.UpdatedAt); err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *PostgresStore) UpsertReport(ctx context.Context, r *models.Report) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.reports (user_id, published_date, body, self_score, source)
		VALUES ($1, $2::date, $3, $4, $5)
		ON CONFLICT (user_id, published_date) DO UPDATE SET
			body = excluded.body,
			self_score = excluded.self_score,
			source = excluded.source,
			updated_at = now()
	`, r.UserID, r.PublishedDate, r.Body, r.SelfScore, r.Source)
	return err
}

func (s *PostgresStore) DeleteReport(ctx context.Context, userID uuid.UUID, date string) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.reports WHERE user_id = $1 AND published_date = $2::date`, userID, date)
	return err
}

func (s *PostgresStore) ListGroups(ctx context.Context, userID uuid.UUID) ([]models.Group, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT g.id, g.name, g.description, g.owner_id, g.invite_code,
		       count(m2.user_id) as member_count, g.created_at, g.updated_at
		FROM public.groups g
		JOIN public.group_members m ON m.group_id = g.id AND m.user_id = $1
		LEFT JOIN public.group_members m2 ON m2.group_id = g.id
		GROUP BY g.id
		ORDER BY g.created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var groups []models.Group
	for rows.Next() {
		var g models.Group
		if err := rows.Scan(&g.ID, &g.Name, &g.Description, &g.OwnerID, &g.InviteCode, &g.MemberCount, &g.CreatedAt, &g.UpdatedAt); err != nil {
			return nil, err
		}
		groups = append(groups, g)
	}
	return groups, nil
}

func (s *PostgresStore) CreateGroup(ctx context.Context, g *models.Group, ownerID uuid.UUID) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	row := tx.QueryRow(ctx, `
		INSERT INTO public.groups (name, description, owner_id, invite_code)
		VALUES ($1, $2, $3, $4)
		RETURNING id, created_at, updated_at
	`, g.Name, g.Description, ownerID, g.InviteCode)
	if err := row.Scan(&g.ID, &g.CreatedAt, &g.UpdatedAt); err != nil {
		return err
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO public.group_members (group_id, user_id, role)
		VALUES ($1, $2, 'owner')
	`, g.ID, ownerID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func (s *PostgresStore) GetGroupByInvite(ctx context.Context, code string) (*models.Group, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, description, owner_id, invite_code, created_at, updated_at
		FROM public.groups WHERE lower(invite_code) = lower($1)
	`, code)
	var g models.Group
	if err := row.Scan(&g.ID, &g.Name, &g.Description, &g.OwnerID, &g.InviteCode, &g.CreatedAt, &g.UpdatedAt); err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *PostgresStore) GetGroup(ctx context.Context, groupID uuid.UUID) (*models.Group, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, name, description, owner_id, invite_code, created_at, updated_at
		FROM public.groups WHERE id = $1
	`, groupID)
	var g models.Group
	if err := row.Scan(&g.ID, &g.Name, &g.Description, &g.OwnerID, &g.InviteCode, &g.CreatedAt, &g.UpdatedAt); err != nil {
		return nil, err
	}
	return &g, nil
}

func (s *PostgresStore) JoinGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID, role string) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO public.group_members (group_id, user_id, role)
		VALUES ($1, $2, $3)
		ON CONFLICT (group_id, user_id) DO NOTHING
	`, groupID, userID, role)
	return err
}

func (s *PostgresStore) LeaveGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `DELETE FROM public.group_members WHERE group_id = $1 AND user_id = $2`, groupID, userID)
	return err
}

func (s *PostgresStore) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]models.GroupMember, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT gm.group_id, gm.user_id, gm.role,
		       coalesce(p.display_name, 'Member'), coalesce(p.avatar_url, ''),
		       ps.phase, ps.task_id, ps.task_title, ps.phase_ends_at, ps.remaining_sec,
		       gm.joined_at
		FROM public.group_members gm
		LEFT JOIN public.profiles p ON p.id = gm.user_id
		LEFT JOIN public.pomo_sessions ps ON ps.user_id = gm.user_id
		WHERE gm.group_id = $1
		ORDER BY gm.joined_at ASC
	`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var members []models.GroupMember
	for rows.Next() {
		var m models.GroupMember
		var phase *string
		var taskID *uuid.UUID
		var taskTitle *string
		var phaseEndsAt *time.Time
		var remainingSec *int

		if err := rows.Scan(&m.GroupID, &m.UserID, &m.Role, &m.DisplayName, &m.AvatarURL, &phase, &taskID, &taskTitle, &phaseEndsAt, &remainingSec, &m.JoinedAt); err != nil {
			return nil, err
		}
		if phase != nil {
			m.Session = &models.PomoSession{
				UserID:       m.UserID,
				Phase:        models.SessionPhase(*phase),
				TaskID:       taskID,
				TaskTitle:    taskTitle,
				PhaseEndsAt:  phaseEndsAt,
				RemainingSec: remainingSec,
			}
		}
		members = append(members, m)
	}
	return members, nil
}

func (s *PostgresStore) GetStatsSummary(ctx context.Context, userID uuid.UUID) (*models.StatsSummary, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT
			coalesce(sum(p.duration_sec) FILTER (WHERE p.started_at >= date_trunc('day', now())), 0) as today_focus_sec,
			coalesce(sum(p.duration_sec) FILTER (WHERE p.started_at >= date_trunc('week', now())), 0) as week_focus_sec,
			(SELECT count(t.id) FROM public.tasks t WHERE t.user_id = $1 AND t.status = 'COMPLETED') as completed_tasks
		FROM public.pomos p
		WHERE p.user_id = $1
	`, userID)

	var todaySec, weekSec, completedTasks int
	if err := row.Scan(&todaySec, &weekSec, &completedTasks); err != nil {
		return nil, err
	}

	todayMin := todaySec / 60
	todayPomos := 0
	if todayMin > 0 {
		todayPomos = (todayMin + 24) / 25
	}

	weekMin := weekSec / 60
	weekPomos := 0
	if weekMin > 0 {
		weekPomos = (weekMin + 24) / 25
	}

	return &models.StatsSummary{
		TodayPomos:          todayPomos,
		TodayFocusMinutes:   todayMin,
		TotalFocusSec:       todaySec,
		WeekPomos:           weekPomos,
		WeekFocusMinutes:    weekMin,
		TotalTasksCompleted: completedTasks,
	}, nil
}
