package api_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ryo09020/ketchup-desktop/server/internal/ai"
	"github.com/ryo09020/ketchup-desktop/server/internal/api"
	"github.com/ryo09020/ketchup-desktop/server/internal/models"
	"github.com/ryo09020/ketchup-desktop/server/internal/store"
)

func setupTestServer() http.Handler {
	s := store.NewMemoryStore()
	g := ai.NewGeminiClient("")
	h := api.NewHandler(s, g)
	return api.NewRouter(h, "")
}

func TestHealthz(t *testing.T) {
	router := setupTestServer()
	req := httptest.NewRequest("GET", "/healthz", nil)
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
}

func TestTasksCRUD(t *testing.T) {
	router := setupTestServer()

	// 1. Create Task
	createPayload := models.CreateTaskRequest{
		Title: "Test Pomodoro Task",
	}
	body, _ := json.Marshal(createPayload)
	req := httptest.NewRequest("POST", "/v1/tasks", bytes.NewBuffer(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	if w.Code != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d: %s", w.Code, w.Body.String())
	}

	var createdTask models.Task
	_ = json.NewDecoder(w.Body).Decode(&createdTask)
	if createdTask.Title != "Test Pomodoro Task" {
		t.Fatalf("expected title 'Test Pomodoro Task', got '%s'", createdTask.Title)
	}

	// 2. List Tasks
	listReq := httptest.NewRequest("GET", "/v1/tasks", nil)
	listW := httptest.NewRecorder()
	router.ServeHTTP(listW, listReq)

	if listW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", listW.Code)
	}
	var tasks []models.Task
	_ = json.NewDecoder(listW.Body).Decode(&tasks)
	if len(tasks) != 1 {
		t.Fatalf("expected 1 task, got %d", len(tasks))
	}

	// 3. Update Task
	completed := models.TaskStatusCompleted
	updatePayload := models.UpdateTaskRequest{
		Status: &completed,
	}
	upBody, _ := json.Marshal(updatePayload)
	upReq := httptest.NewRequest("PATCH", "/v1/tasks/"+createdTask.ID.String(), bytes.NewBuffer(upBody))
	upReq.Header.Set("Content-Type", "application/json")
	upW := httptest.NewRecorder()
	router.ServeHTTP(upW, upReq)

	if upW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", upW.Code)
	}

	// 4. Stats Summary
	statsReq := httptest.NewRequest("GET", "/v1/stats/summary", nil)
	statsW := httptest.NewRecorder()
	router.ServeHTTP(statsW, statsReq)
	if statsW.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", statsW.Code)
	}
	var stats models.StatsSummary
	_ = json.NewDecoder(statsW.Body).Decode(&stats)
	if stats.TotalTasksCompleted != 1 {
		t.Fatalf("expected 1 completed task in stats, got %d", stats.TotalTasksCompleted)
	}
}

func TestVoiceToReportFallback(t *testing.T) {
	router := setupTestServer()
	reqBody, _ := json.Marshal(models.VoiceToReportRequest{
		AudioBase64: "dummy",
		MimeType:    "audio/webm",
		Date:        "2026-10-24",
	})
	req := httptest.NewRequest("POST", "/v1/ai/voice-to-report", bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", w.Code)
	}
	var res models.VoiceToReportResponse
	_ = json.NewDecoder(w.Body).Decode(&res)
	if res.DraftBody == "" {
		t.Fatalf("expected non-empty draft body")
	}
}
