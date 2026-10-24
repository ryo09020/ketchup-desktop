package models

import (
	"time"

	"github.com/google/uuid"
)

type Profile struct {
	ID          uuid.UUID `json:"id"`
	Email       string    `json:"email"`
	DisplayName string    `json:"displayName"`
	AvatarURL   string    `json:"avatarUrl"`
	Timezone    string    `json:"timezone"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type UserSettings struct {
	UserID            uuid.UUID `json:"userId"`
	FocusSec          int       `json:"focusSec"`
	LastTermSec       int       `json:"lastTermSec"`       // 前回設定したダイヤル/ターム秒数 (次回デフォルト)
	ShortBreakSec     int       `json:"shortBreakSec"`
	LongBreakSec      int       `json:"longBreakSec"`
	LongBreakInterval int       `json:"longBreakInterval"`
	AutoStartBreaks   bool      `json:"autoStartBreaks"`
	AutoStartFocus    bool      `json:"autoStartFocus"`
	ObsidianVaultPath string    `json:"obsidianVaultPath"` // Obsidian連携先パス (例: ~/Documents/Obsidian/Daily)
	UpdatedAt         time.Time `json:"updatedAt"`
}

type MeResponse struct {
	Profile  Profile      `json:"profile"`
	Settings UserSettings `json:"settings"`
}

type UpdateMeRequest struct {
	DisplayName *string `json:"displayName,omitempty"`
	AvatarURL   *string `json:"avatarUrl,omitempty"`
	Timezone    *string `json:"timezone,omitempty"`
}

type TaskStatus string

const (
	TaskStatusTodo       TaskStatus = "TODO"
	TaskStatusInProgress TaskStatus = "IN_PROGRESS"
	TaskStatusCompleted  TaskStatus = "COMPLETED"
)

type Task struct {
	ID             uuid.UUID  `json:"id"`
	UserID         uuid.UUID  `json:"userId"`
	Title          string     `json:"title"`
	Note           string     `json:"note"`
	Status         TaskStatus `json:"status"`
	EstimatedPomos int        `json:"estimatedPomos"`
	PomoCount      int        `json:"pomoCount"`
	ActualFocusSec int        `json:"actualFocusSec"` // 実際に作業した正確な秒数
	Category       string     `json:"category"`       // AI判定/大グループ (例: 英語学習, 数学)
	Topic          string     `json:"topic"`          // AI判定/小グループ (例: 単語暗記, 過去問演習)
	DueDate        *string    `json:"dueDate,omitempty"`
	Project        *string    `json:"project,omitempty"`
	SortOrder      float64    `json:"sortOrder"`
	CompletedAt    *time.Time `json:"completedAt,omitempty"`
	CreatedAt      time.Time  `json:"createdAt"`
	UpdatedAt      time.Time  `json:"updatedAt"`
}

type CreateTaskRequest struct {
	Title          string  `json:"title"`
	Note           *string `json:"note,omitempty"`
	EstimatedPomos *int    `json:"estimatedPomos,omitempty"`
	Category       *string `json:"category,omitempty"`
	Topic          *string `json:"topic,omitempty"`
	DueDate        *string `json:"dueDate,omitempty"`
	Project        *string `json:"project,omitempty"`
}

type UpdateTaskRequest struct {
	Title          *string     `json:"title,omitempty"`
	Note           *string     `json:"note,omitempty"`
	Status         *TaskStatus `json:"status,omitempty"`
	EstimatedPomos *int        `json:"estimatedPomos,omitempty"`
	ActualFocusSec *int        `json:"actualFocusSec,omitempty"`
	Category       *string     `json:"category,omitempty"`
	Topic          *string     `json:"topic,omitempty"`
	DueDate        *string     `json:"dueDate,omitempty"`
	Project        *string     `json:"project,omitempty"`
	SortOrder      *float64    `json:"sortOrder,omitempty"`
}

type Pomo struct {
	ID          uuid.UUID  `json:"id"`
	UserID      uuid.UUID  `json:"userId"`
	TaskID      *uuid.UUID `json:"taskId,omitempty"`
	ClientID    uuid.UUID  `json:"clientId"`
	StartedAt   time.Time  `json:"startedAt"`
	EndedAt     time.Time  `json:"endedAt"`
	DurationSec int        `json:"durationSec"` // 実際の作業秒数 (10分なら600秒)
	PomoCount   int        `json:"pomoCount"`   // 25分基準の繰り上げ換算pomo数 (ceil(durationSec/60 / 25))
	CreatedAt   time.Time  `json:"createdAt"`
}

type CreatePomoRequest struct {
	ClientID    uuid.UUID  `json:"clientId"`
	TaskID      *uuid.UUID `json:"taskId,omitempty"`
	StartedAt   time.Time  `json:"startedAt"`
	EndedAt     time.Time  `json:"endedAt"`
	DurationSec int        `json:"durationSec"`
}

type SessionPhase string

const (
	SessionPhaseIdle       SessionPhase = "IDLE"
	SessionPhaseFocus      SessionPhase = "FOCUS"
	SessionPhasePaused     SessionPhase = "PAUSED"
	SessionPhaseShortBreak SessionPhase = "SHORT_BREAK"
	SessionPhaseLongBreak  SessionPhase = "LONG_BREAK"
)

type PomoSession struct {
	UserID       uuid.UUID    `json:"userId"`
	Phase        SessionPhase `json:"phase"`
	TaskID       *uuid.UUID   `json:"taskId,omitempty"`
	TaskTitle    *string      `json:"taskTitle,omitempty"`
	PhaseEndsAt  *time.Time   `json:"phaseEndsAt,omitempty"`
	RemainingSec *int         `json:"remainingSec,omitempty"`
	UpdatedAt    time.Time    `json:"updatedAt"`
}

type UpdateSessionRequest struct {
	Phase        SessionPhase `json:"phase"`
	TaskID       *uuid.UUID   `json:"taskId,omitempty"`
	TaskTitle    *string      `json:"taskTitle,omitempty"`
	PhaseEndsAt  *time.Time   `json:"phaseEndsAt,omitempty"`
	RemainingSec *int         `json:"remainingSec,omitempty"`
}

type ReportSource string

const (
	ReportSourceManual ReportSource = "manual"
	ReportSourceVoice  ReportSource = "voice"
	ReportSourceAI     ReportSource = "ai"
)

type Report struct {
	ID            uuid.UUID    `json:"id"`
	UserID        uuid.UUID    `json:"userId"`
	PublishedDate string       `json:"publishedDate"` // YYYY-MM-DD
	Body          string       `json:"body"`
	AutoFacts     string       `json:"autoFacts,omitempty"` // AI/システム生成の今日の事実 (完了タスク, 集中時間)
	Learnings     string       `json:"learnings,omitempty"` // 人間が書く学び・気づき
	Challenges    string       `json:"challenges,omitempty"`// 人間が書く課題・改善点
	NextActions   string       `json:"nextActions,omitempty"`// 明日のアクション
	SelfScore     *int         `json:"selfScore,omitempty"`
	Source        ReportSource `json:"source"`
	CreatedAt     time.Time    `json:"createdAt"`
	UpdatedAt     time.Time    `json:"updatedAt"`
}

type CreateReportRequest struct {
	PublishedDate string  `json:"publishedDate"`
	Body          string  `json:"body"`
	AutoFacts     *string `json:"autoFacts,omitempty"`
	Learnings     *string `json:"learnings,omitempty"`
	Challenges    *string `json:"challenges,omitempty"`
	NextActions   *string `json:"nextActions,omitempty"`
	SelfScore     *int    `json:"selfScore,omitempty"`
	Source        *string `json:"source,omitempty"`
}

type VoiceToReportRequest struct {
	AudioBase64 string `json:"audioBase64"`
	MimeType    string `json:"mimeType"`
	Date        string `json:"date"`
}

type VoiceToReportResponse struct {
	Transcript string `json:"transcript"`
	DraftBody  string `json:"draftBody"`
}

type AISummaryRequest struct {
	Scope       string `json:"scope"`
	PeriodStart string `json:"periodStart"`
	PeriodEnd   string `json:"periodEnd"`
}

type AISummaryResponse struct {
	Content     string `json:"content"`
	PeriodStart string `json:"periodStart"`
	PeriodEnd   string `json:"periodEnd"`
	Scope       string `json:"scope"`
}

type AIClassifyTaskRequest struct {
	Title string `json:"title"`
}

type AIClassifyTaskResponse struct {
	Category string `json:"category"` // 大グループ
	Topic    string `json:"topic"`    // 小グループ
}

type AutoDraftReportRequest struct {
	Date string `json:"date"`
}

type AutoDraftReportResponse struct {
	AutoFacts string `json:"autoFacts"`
	DraftBody string `json:"draftBody"`
}

type Group struct {
	ID          uuid.UUID `json:"id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	OwnerID     uuid.UUID `json:"ownerId"`
	InviteCode  string    `json:"inviteCode"`
	MemberCount int       `json:"memberCount"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

type GroupMember struct {
	GroupID     uuid.UUID    `json:"groupId"`
	UserID      uuid.UUID    `json:"userId"`
	Role        string       `json:"role"`
	DisplayName string       `json:"displayName"`
	AvatarURL   string       `json:"avatarUrl"`
	Session     *PomoSession `json:"session,omitempty"`
	JoinedAt    time.Time    `json:"joinedAt"`
}

type CreateGroupRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type JoinGroupRequest struct {
	InviteCode string `json:"inviteCode"`
}

type StatsSummary struct {
	TodayPomos          int `json:"todayPomos"`
	TodayFocusMinutes   int `json:"todayFocusMinutes"`
	TotalFocusSec       int `json:"totalFocusSec"`
	WeekPomos           int `json:"weekPomos"`
	WeekFocusMinutes    int `json:"weekFocusMinutes"`
	TotalTasksCompleted int `json:"totalTasksCompleted"`
}
