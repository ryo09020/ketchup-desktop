package store

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/ryo09020/ketchup-desktop/server/internal/models"
)

type Store interface {
	// Me & Profiles
	GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error)
	UpsertProfile(ctx context.Context, p *models.Profile) error
	GetUserSettings(ctx context.Context, userID uuid.UUID) (*models.UserSettings, error)
	UpsertUserSettings(ctx context.Context, s *models.UserSettings) error
	DeleteUser(ctx context.Context, userID uuid.UUID) error

	// Tasks
	ListTasks(ctx context.Context, userID uuid.UUID, status *models.TaskStatus, project *string) ([]models.Task, error)
	GetTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) (*models.Task, error)
	CreateTask(ctx context.Context, task *models.Task) error
	UpdateTask(ctx context.Context, task *models.Task) error
	DeleteTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) error

	// Pomos
	RecordPomo(ctx context.Context, pomo *models.Pomo) error
	ListPomos(ctx context.Context, userID uuid.UUID, since time.Time) ([]models.Pomo, error)

	// Session
	GetSession(ctx context.Context, userID uuid.UUID) (*models.PomoSession, error)
	UpdateSession(ctx context.Context, s *models.PomoSession) error

	// Reports
	ListReports(ctx context.Context, userID uuid.UUID, limit int) ([]models.Report, error)
	GetReportByDate(ctx context.Context, userID uuid.UUID, date string) (*models.Report, error)
	UpsertReport(ctx context.Context, report *models.Report) error
	DeleteReport(ctx context.Context, userID uuid.UUID, date string) error

	// Groups
	ListGroups(ctx context.Context, userID uuid.UUID) ([]models.Group, error)
	CreateGroup(ctx context.Context, g *models.Group, ownerID uuid.UUID) error
	GetGroupByInvite(ctx context.Context, code string) (*models.Group, error)
	GetGroup(ctx context.Context, groupID uuid.UUID) (*models.Group, error)
	JoinGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID, role string) error
	LeaveGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) error
	ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]models.GroupMember, error)

	// Stats
	GetStatsSummary(ctx context.Context, userID uuid.UUID) (*models.StatsSummary, error)
}

// MemoryStore provides in-memory fallback storage
type MemoryStore struct {
	mu           sync.RWMutex
	profiles     map[uuid.UUID]*models.Profile
	settings     map[uuid.UUID]*models.UserSettings
	tasks        map[uuid.UUID]*models.Task
	pomos        map[uuid.UUID]*models.Pomo
	sessions     map[uuid.UUID]*models.PomoSession
	reports      map[string]*models.Report // key: userID_date
	groups       map[uuid.UUID]*models.Group
	groupMembers map[uuid.UUID]map[uuid.UUID]string // groupID -> userID -> role
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		profiles:     make(map[uuid.UUID]*models.Profile),
		settings:     make(map[uuid.UUID]*models.UserSettings),
		tasks:        make(map[uuid.UUID]*models.Task),
		pomos:        make(map[uuid.UUID]*models.Pomo),
		sessions:     make(map[uuid.UUID]*models.PomoSession),
		reports:      make(map[string]*models.Report),
		groups:       make(map[uuid.UUID]*models.Group),
		groupMembers: make(map[uuid.UUID]map[uuid.UUID]string),
	}
}

func (m *MemoryStore) GetProfile(ctx context.Context, userID uuid.UUID) (*models.Profile, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.profiles[userID]
	if !ok {
		// return default
		return &models.Profile{
			ID:          userID,
			Email:       "user@example.com",
			DisplayName: "Ketchup User",
			Timezone:    "Asia/Tokyo",
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}, nil
	}
	return p, nil
}

func (m *MemoryStore) UpsertProfile(ctx context.Context, p *models.Profile) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	p.UpdatedAt = time.Now()
	m.profiles[p.ID] = p
	return nil
}

func (m *MemoryStore) GetUserSettings(ctx context.Context, userID uuid.UUID) (*models.UserSettings, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.settings[userID]
	if !ok {
		return &models.UserSettings{
			UserID:            userID,
			FocusSec:          1500,
			ShortBreakSec:     300,
			LongBreakSec:      900,
			LongBreakInterval: 4,
			AutoStartBreaks:   true,
			AutoStartFocus:    false,
			UpdatedAt:         time.Now(),
		}, nil
	}
	return s, nil
}

func (m *MemoryStore) UpsertUserSettings(ctx context.Context, s *models.UserSettings) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s.UpdatedAt = time.Now()
	m.settings[s.UserID] = s
	return nil
}

func (m *MemoryStore) DeleteUser(ctx context.Context, userID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.profiles, userID)
	delete(m.settings, userID)
	delete(m.sessions, userID)

	for id, t := range m.tasks {
		if t.UserID == userID {
			delete(m.tasks, id)
		}
	}
	for id, p := range m.pomos {
		if p.UserID == userID {
			delete(m.pomos, id)
		}
	}
	for k := range m.reports {
		if strings.HasPrefix(k, userID.String()) {
			delete(m.reports, k)
		}
	}
	for gid, members := range m.groupMembers {
		delete(members, userID)
		if len(members) == 0 {
			delete(m.groups, gid)
		}
	}
	return nil
}

func (m *MemoryStore) ListTasks(ctx context.Context, userID uuid.UUID, status *models.TaskStatus, project *string) ([]models.Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []models.Task
	for _, t := range m.tasks {
		if t.UserID != userID {
			continue
		}
		if status != nil && t.Status != *status {
			continue
		}
		if project != nil && (t.Project == nil || *t.Project != *project) {
			continue
		}

		// Count pomos for task
		pomoCount := 0
		for _, p := range m.pomos {
			if p.TaskID != nil && *p.TaskID == t.ID {
				pomoCount++
			}
		}
		tc := *t
		tc.PomoCount = pomoCount
		result = append(result, tc)
	}

	sort.Slice(result, func(i, j int) bool {
		return result[i].SortOrder < result[j].SortOrder
	})
	return result, nil
}

func (m *MemoryStore) GetTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) (*models.Task, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	t, ok := m.tasks[taskID]
	if !ok || t.UserID != userID {
		return nil, fmt.Errorf("task not found")
	}
	return t, nil
}

func (m *MemoryStore) CreateTask(ctx context.Context, task *models.Task) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if task.ID == uuid.Nil {
		task.ID = uuid.New()
	}
	task.CreatedAt = time.Now()
	task.UpdatedAt = time.Now()
	m.tasks[task.ID] = task
	return nil
}

func (m *MemoryStore) UpdateTask(ctx context.Context, task *models.Task) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	task.UpdatedAt = time.Now()
	m.tasks[task.ID] = task
	return nil
}

func (m *MemoryStore) DeleteTask(ctx context.Context, userID uuid.UUID, taskID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	t, ok := m.tasks[taskID]
	if !ok || t.UserID != userID {
		return fmt.Errorf("task not found")
	}
	delete(m.tasks, taskID)
	return nil
}

func (m *MemoryStore) RecordPomo(ctx context.Context, pomo *models.Pomo) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if pomo.ID == uuid.Nil {
		pomo.ID = uuid.New()
	}
	pomo.CreatedAt = time.Now()

	// 59秒以下は0分換算、25分で1pomo、26分等は切り上げで2pomo
	mins := pomo.DurationSec / 60
	if mins == 0 {
		pomo.PomoCount = 0
	} else {
		pomo.PomoCount = (mins + 24) / 25
	}

	m.pomos[pomo.ID] = pomo

	// タスクが指定されている場合、タスクの実績秒数とpomo数を更新
	if pomo.TaskID != nil {
		if t, ok := m.tasks[*pomo.TaskID]; ok {
			t.ActualFocusSec += pomo.DurationSec
			tMins := t.ActualFocusSec / 60
			if tMins == 0 {
				t.PomoCount = 0
			} else {
				t.PomoCount = (tMins + 24) / 25
			}
			t.UpdatedAt = time.Now()
		}
	}

	return nil
}

func (m *MemoryStore) ListPomos(ctx context.Context, userID uuid.UUID, since time.Time) ([]models.Pomo, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []models.Pomo
	for _, p := range m.pomos {
		if p.UserID == userID && (p.StartedAt.After(since) || p.StartedAt.Equal(since)) {
			result = append(result, *p)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].StartedAt.Before(result[j].StartedAt)
	})
	return result, nil
}

func (m *MemoryStore) GetSession(ctx context.Context, userID uuid.UUID) (*models.PomoSession, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[userID]
	if !ok {
		return &models.PomoSession{
			UserID:    userID,
			Phase:     models.SessionPhaseIdle,
			UpdatedAt: time.Now(),
		}, nil
	}
	return s, nil
}

func (m *MemoryStore) UpdateSession(ctx context.Context, s *models.PomoSession) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	s.UpdatedAt = time.Now()
	m.sessions[s.UserID] = s
	return nil
}

func (m *MemoryStore) ListReports(ctx context.Context, userID uuid.UUID, limit int) ([]models.Report, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []models.Report
	for _, r := range m.reports {
		if r.UserID == userID {
			result = append(result, *r)
		}
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i].PublishedDate > result[j].PublishedDate
	})
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	return result, nil
}

func (m *MemoryStore) GetReportByDate(ctx context.Context, userID uuid.UUID, date string) (*models.Report, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	key := fmt.Sprintf("%s_%s", userID.String(), date)
	r, ok := m.reports[key]
	if !ok {
		return nil, fmt.Errorf("report not found")
	}
	return r, nil
}

func (m *MemoryStore) UpsertReport(ctx context.Context, report *models.Report) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if report.ID == uuid.Nil {
		report.ID = uuid.New()
	}
	report.UpdatedAt = time.Now()
	if report.CreatedAt.IsZero() {
		report.CreatedAt = time.Now()
	}
	key := fmt.Sprintf("%s_%s", report.UserID.String(), report.PublishedDate)
	m.reports[key] = report
	return nil
}

func (m *MemoryStore) DeleteReport(ctx context.Context, userID uuid.UUID, date string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	key := fmt.Sprintf("%s_%s", userID.String(), date)
	delete(m.reports, key)
	return nil
}

func (m *MemoryStore) ListGroups(ctx context.Context, userID uuid.UUID) ([]models.Group, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []models.Group
	for gid, members := range m.groupMembers {
		if _, ok := members[userID]; ok {
			if g, exists := m.groups[gid]; exists {
				copyG := *g
				copyG.MemberCount = len(members)
				result = append(result, copyG)
			}
		}
	}
	return result, nil
}

func (m *MemoryStore) CreateGroup(ctx context.Context, g *models.Group, ownerID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if g.ID == uuid.Nil {
		g.ID = uuid.New()
	}
	g.OwnerID = ownerID
	if g.InviteCode == "" {
		g.InviteCode = strings.ToUpper(uuid.New().String()[:8])
	}
	g.CreatedAt = time.Now()
	g.UpdatedAt = time.Now()
	g.MemberCount = 1
	m.groups[g.ID] = g

	if _, ok := m.groupMembers[g.ID]; !ok {
		m.groupMembers[g.ID] = make(map[uuid.UUID]string)
	}
	m.groupMembers[g.ID][ownerID] = "owner"
	return nil
}

func (m *MemoryStore) GetGroupByInvite(ctx context.Context, code string) (*models.Group, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, g := range m.groups {
		if strings.EqualFold(g.InviteCode, code) {
			return g, nil
		}
	}
	return nil, fmt.Errorf("group not found with invite code")
}

func (m *MemoryStore) GetGroup(ctx context.Context, groupID uuid.UUID) (*models.Group, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	g, ok := m.groups[groupID]
	if !ok {
		return nil, fmt.Errorf("group not found")
	}
	return g, nil
}

func (m *MemoryStore) JoinGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID, role string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.groups[groupID]; !ok {
		return fmt.Errorf("group not found")
	}
	if _, ok := m.groupMembers[groupID]; !ok {
		m.groupMembers[groupID] = make(map[uuid.UUID]string)
	}
	m.groupMembers[groupID][userID] = role
	return nil
}

func (m *MemoryStore) LeaveGroup(ctx context.Context, groupID uuid.UUID, userID uuid.UUID) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if members, ok := m.groupMembers[groupID]; ok {
		delete(members, userID)
	}
	return nil
}

func (m *MemoryStore) ListGroupMembers(ctx context.Context, groupID uuid.UUID) ([]models.GroupMember, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var result []models.GroupMember
	members, ok := m.groupMembers[groupID]
	if !ok {
		return result, nil
	}

	for uid, role := range members {
		prof, _ := m.profiles[uid]
		dName := "Member"
		avatar := ""
		if prof != nil {
			dName = prof.DisplayName
			avatar = prof.AvatarURL
		}
		sess := m.sessions[uid]
		result = append(result, models.GroupMember{
			GroupID:     groupID,
			UserID:      uid,
			Role:        role,
			DisplayName: dName,
			AvatarURL:   avatar,
			Session:     sess,
			JoinedAt:    time.Now(),
		})
	}
	return result, nil
}

func (m *MemoryStore) GetStatsSummary(ctx context.Context, userID uuid.UUID) (*models.StatsSummary, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	now := time.Now()
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	weekStart := todayStart.AddDate(0, 0, -int(now.Weekday()))

	todayFocusSec := 0
	weekFocusSec := 0

	for _, p := range m.pomos {
		if p.UserID != userID {
			continue
		}
		if p.StartedAt.After(todayStart) {
			todayFocusSec += p.DurationSec
		}
		if p.StartedAt.After(weekStart) {
			weekFocusSec += p.DurationSec
		}
	}

	todayFocusMin := todayFocusSec / 60
	todayPomos := 0
	if todayFocusMin > 0 {
		todayPomos = (todayFocusMin + 24) / 25
	}

	weekFocusMin := weekFocusSec / 60
	weekPomos := 0
	if weekFocusMin > 0 {
		weekPomos = (weekFocusMin + 24) / 25
	}

	completedTasks := 0
	for _, t := range m.tasks {
		if t.UserID == userID && t.Status == models.TaskStatusCompleted {
			completedTasks++
		}
	}

	return &models.StatsSummary{
		TodayPomos:          todayPomos,
		TodayFocusMinutes:   todayFocusMin,
		TotalFocusSec:       todayFocusSec,
		WeekPomos:           weekPomos,
		WeekFocusMinutes:    weekFocusMin,
		TotalTasksCompleted: completedTasks,
	}, nil
}
