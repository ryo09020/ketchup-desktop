package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/ryo09020/ketchup-desktop/server/internal/ai"
	"github.com/ryo09020/ketchup-desktop/server/internal/middleware"
	"github.com/ryo09020/ketchup-desktop/server/internal/models"
	"github.com/ryo09020/ketchup-desktop/server/internal/store"
)

type Handler struct {
	store  store.Store
	gemini *ai.GeminiClient
}

func NewHandler(s store.Store, g *ai.GeminiClient) *Handler {
	return &Handler{
		store:  s,
		gemini: g,
	}
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]interface{}{
		"code":    code,
		"message": message,
	})
}

// Healthz
func (h *Handler) Healthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Me
func (h *Handler) GetMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	profile, err := h.store.GetProfile(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	settings, err := h.store.GetUserSettings(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, models.MeResponse{
		Profile:  *profile,
		Settings: *settings,
	})
}

func (h *Handler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.UpdateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	p, err := h.store.GetProfile(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if req.DisplayName != nil {
		p.DisplayName = *req.DisplayName
	}
	if req.AvatarURL != nil {
		p.AvatarURL = *req.AvatarURL
	}
	if req.Timezone != nil {
		p.Timezone = *req.Timezone
	}
	if err := h.store.UpsertProfile(r.Context(), p); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	settings, _ := h.store.GetUserSettings(r.Context(), userID)
	writeJSON(w, http.StatusOK, models.MeResponse{
		Profile:  *p,
		Settings: *settings,
	})
}

func (h *Handler) DeleteMe(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	if err := h.store.DeleteUser(r.Context(), userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var s models.UserSettings
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	s.UserID = userID
	if err := h.store.UpsertUserSettings(r.Context(), &s); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, s)
}

// Tasks
func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var status *models.TaskStatus
	if s := r.URL.Query().Get("status"); s != "" {
		st := models.TaskStatus(s)
		status = &st
	}
	var project *string
	if p := r.URL.Query().Get("project"); p != "" {
		project = &p
	}
	tasks, err := h.store.ListTasks(r.Context(), userID, status, project)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if tasks == nil {
		tasks = []models.Task{}
	}
	writeJSON(w, http.StatusOK, tasks)
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	est := 1
	if req.EstimatedPomos != nil {
		est = *req.EstimatedPomos
	}
	note := ""
	if req.Note != nil {
		note = *req.Note
	}

	category := "一般タスク"
	topic := "タスク"
	if req.Category != nil && *req.Category != "" {
		category = *req.Category
	}
	if req.Topic != nil && *req.Topic != "" {
		topic = *req.Topic
	}
	if req.Category == nil || *req.Category == "" {
		if classified, err := h.gemini.ClassifyTask(r.Context(), req.Title); err == nil {
			category = classified.Category
			topic = classified.Topic
		}
	}

	t := &models.Task{
		UserID:         userID,
		Title:          req.Title,
		Note:           note,
		Status:         models.TaskStatusTodo,
		EstimatedPomos: est,
		Category:       category,
		Topic:          topic,
		DueDate:        req.DueDate,
		Project:        req.Project,
		SortOrder:      float64(time.Now().Unix()),
	}

	if err := h.store.CreateTask(r.Context(), t); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, t)
}

func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	taskID, err := uuid.Parse(chi.URLParam(r, "taskId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid taskId")
		return
	}
	var req models.UpdateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	t, err := h.store.GetTask(r.Context(), userID, taskID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "task not found")
		return
	}

	if req.Title != nil {
		t.Title = *req.Title
	}
	if req.Note != nil {
		t.Note = *req.Note
	}
	if req.Status != nil {
		t.Status = *req.Status
		if *req.Status == models.TaskStatusCompleted && t.CompletedAt == nil {
			now := time.Now()
			t.CompletedAt = &now
		} else if *req.Status != models.TaskStatusCompleted {
			t.CompletedAt = nil
		}
	}
	if req.EstimatedPomos != nil {
		t.EstimatedPomos = *req.EstimatedPomos
	}
	if req.ActualFocusSec != nil {
		t.ActualFocusSec = *req.ActualFocusSec
	}
	if req.Category != nil {
		t.Category = *req.Category
	}
	if req.Topic != nil {
		t.Topic = *req.Topic
	}
	if req.DueDate != nil {
		t.DueDate = req.DueDate
	}
	if req.Project != nil {
		t.Project = req.Project
	}
	if req.SortOrder != nil {
		t.SortOrder = *req.SortOrder
	}

	if err := h.store.UpdateTask(r.Context(), t); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, t)
}

func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	taskID, err := uuid.Parse(chi.URLParam(r, "taskId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid taskId")
		return
	}
	if err := h.store.DeleteTask(r.Context(), userID, taskID); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// Pomos
func (h *Handler) RecordPomo(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.CreatePomoRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	pomo := &models.Pomo{
		UserID:      userID,
		TaskID:      req.TaskID,
		ClientID:    req.ClientID,
		StartedAt:   req.StartedAt,
		EndedAt:     req.EndedAt,
		DurationSec: req.DurationSec,
	}

	if err := h.store.RecordPomo(r.Context(), pomo); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, pomo)
}

func (h *Handler) ListPomos(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	dateStr := r.URL.Query().Get("date")
	sinceStr := r.URL.Query().Get("since")

	var since time.Time
	if dateStr != "" {
		parsed, err := time.Parse("2006-01-02", dateStr)
		if err == nil {
			since = parsed
		}
	} else if sinceStr != "" {
		parsed, err := time.Parse(time.RFC3339, sinceStr)
		if err == nil {
			since = parsed
		}
	}

	if since.IsZero() {
		now := time.Now()
		since = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	}

	pomos, err := h.store.ListPomos(r.Context(), userID, since)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if pomos == nil {
		pomos = []models.Pomo{}
	}
	writeJSON(w, http.StatusOK, pomos)
}

// Session
func (h *Handler) GetSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	sess, err := h.store.GetSession(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

func (h *Handler) UpdateSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.UpdateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	sess := &models.PomoSession{
		UserID:       userID,
		Phase:        req.Phase,
		TaskID:       req.TaskID,
		TaskTitle:    req.TaskTitle,
		PhaseEndsAt:  req.PhaseEndsAt,
		RemainingSec: req.RemainingSec,
	}

	if err := h.store.UpdateSession(r.Context(), sess); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, sess)
}

// Reports
func (h *Handler) ListReports(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	limit := 30
	if l := r.URL.Query().Get("limit"); l != "" {
		if val, err := strconv.Atoi(l); err == nil {
			limit = val
		}
	}
	reports, err := h.store.ListReports(r.Context(), userID, limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if reports == nil {
		reports = []models.Report{}
	}
	writeJSON(w, http.StatusOK, reports)
}

func (h *Handler) GetReportByDate(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	date := chi.URLParam(r, "date")
	report, err := h.store.GetReportByDate(r.Context(), userID, date)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "report not found")
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *Handler) UpsertReport(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.CreateReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}

	src := models.ReportSourceManual
	if req.Source != nil {
		src = models.ReportSource(*req.Source)
	}

	report := &models.Report{
		UserID:        userID,
		PublishedDate: req.PublishedDate,
		Body:          req.Body,
		SelfScore:     req.SelfScore,
		Source:        src,
	}

	if err := h.store.UpsertReport(r.Context(), report); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, report)
}

func (h *Handler) DeleteReport(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	date := chi.URLParam(r, "date")
	if err := h.store.DeleteReport(r.Context(), userID, date); err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// AI
func (h *Handler) VoiceToReport(w http.ResponseWriter, r *http.Request) {
	var req models.VoiceToReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	res, err := h.gemini.VoiceToReport(r.Context(), req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) AISummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.AISummaryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	reports, _ := h.store.ListReports(r.Context(), userID, 30)
	since, _ := time.Parse("2006-01-02", req.PeriodStart)
	pomos, _ := h.store.ListPomos(r.Context(), userID, since)

	res, err := h.gemini.GenerateSummary(r.Context(), req.Scope, req.PeriodStart, req.PeriodEnd, reports, pomos)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) ClassifyTask(w http.ResponseWriter, r *http.Request) {
	var req models.AIClassifyTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	res, err := h.gemini.ClassifyTask(r.Context(), req.Title)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "AI_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, res)
}

func (h *Handler) AutoDraftReport(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	date := r.URL.Query().Get("date")
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	since, _ := time.Parse("2006-01-02", date)
	until := since.Add(24 * time.Hour)
	allPomos, _ := h.store.ListPomos(r.Context(), userID, since)
	var pomos []models.Pomo
	for _, p := range allPomos {
		if p.StartedAt.Before(until) {
			pomos = append(pomos, p)
		}
	}
	tasks, _ := h.store.ListTasks(r.Context(), userID, nil, nil)

	totalSec := 0
	for _, p := range pomos {
		totalSec += p.DurationSec
	}
	totalMin := totalSec / 60
	pomoEquivalent := float64(totalSec) / 1500.0

	var factsBuilder strings.Builder
	factsBuilder.WriteString("## **本日の集中実績** (Facts)\n")
	factsBuilder.WriteString(fmt.Sprintf("- **総集中時間**: %d分 (%.1f pomo)\n", totalMin, pomoEquivalent))
	factsBuilder.WriteString(fmt.Sprintf("- **消化セッション**: %d 回\n\n", len(pomos)))

	factsBuilder.WriteString("### 完了・進行したタスク\n")
	hasTask := false
	for _, t := range tasks {
		if t.Status == models.TaskStatusCompleted || t.PomoCount > 0 {
			hasTask = true
			factsBuilder.WriteString(fmt.Sprintf("- [%s] **%s** (%s > %s) - %d分集中\n",
				string(t.Status), t.Title, t.Category, t.Topic, t.ActualFocusSec/60))
		}
	}
	if !hasTask {
		factsBuilder.WriteString("- (記録されたタスク活動はありません)\n")
	}

	draft := fmt.Sprintf(`%s
## **今日学んだこと・気づき**
- 

## **課題・反省点**
- 

## **明日のアクション**
- 
`, factsBuilder.String())

	writeJSON(w, http.StatusOK, models.AutoDraftReportResponse{
		AutoFacts: factsBuilder.String(),
		DraftBody: draft,
	})
}

// Stats
func (h *Handler) GetStatsSummary(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	stats, err := h.store.GetStatsSummary(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// Groups
func (h *Handler) ListGroups(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	groups, err := h.store.ListGroups(r.Context(), userID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if groups == nil {
		groups = []models.Group{}
	}
	writeJSON(w, http.StatusOK, groups)
}

func (h *Handler) CreateGroup(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.CreateGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	g := &models.Group{
		Name:        req.Name,
		Description: req.Description,
	}
	if err := h.store.CreateGroup(r.Context(), g, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, g)
}

func (h *Handler) JoinGroup(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	var req models.JoinGroupRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", err.Error())
		return
	}
	g, err := h.store.GetGroupByInvite(r.Context(), req.InviteCode)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "invalid invite code")
		return
	}
	if err := h.store.JoinGroup(r.Context(), g.ID, userID, "member"); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, g)
}

func (h *Handler) GetGroup(w http.ResponseWriter, r *http.Request) {
	groupID, err := uuid.Parse(chi.URLParam(r, "groupId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid groupId")
		return
	}
	g, err := h.store.GetGroup(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "group not found")
		return
	}
	writeJSON(w, http.StatusOK, g)
}

func (h *Handler) ListGroupMembers(w http.ResponseWriter, r *http.Request) {
	groupID, err := uuid.Parse(chi.URLParam(r, "groupId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid groupId")
		return
	}
	members, err := h.store.ListGroupMembers(r.Context(), groupID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	if members == nil {
		members = []models.GroupMember{}
	}
	writeJSON(w, http.StatusOK, members)
}

func (h *Handler) LeaveGroup(w http.ResponseWriter, r *http.Request) {
	userID := middleware.GetUserID(r.Context())
	groupID, err := uuid.Parse(chi.URLParam(r, "groupId"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "BAD_REQUEST", "invalid groupId")
		return
	}
	if err := h.store.LeaveGroup(r.Context(), groupID, userID); err != nil {
		writeError(w, http.StatusInternalServerError, "INTERNAL", err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
