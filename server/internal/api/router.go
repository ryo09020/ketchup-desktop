package api

import (
	"net/http"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/ryo09020/ketchup-desktop/server/internal/middleware"
)

func NewRouter(h *Handler, jwtSecret string) http.Handler {
	r := chi.NewRouter()

	// Standard middleware
	r.Use(chimw.Logger)
	r.Use(chimw.Recoverer)
	r.Use(chimw.RequestID)

	// CORS for Tauri & local web dev
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{
			"tauri://localhost",
			"http://tauri.localhost",
			"http://localhost:1420",
			"http://localhost:5173",
			"http://localhost:3000",
			"http://127.0.0.1:*",
		},
		AllowedMethods:   []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-User-ID", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// Public routes
	r.Get("/healthz", h.Healthz)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.AuthMiddleware(jwtSecret))

		// Me
		r.Get("/v1/me", h.GetMe)
		r.Patch("/v1/me", h.UpdateMe)
		r.Delete("/v1/me", h.DeleteMe)
		r.Put("/v1/me/settings", h.UpdateSettings)

		// Tasks
		r.Get("/v1/tasks", h.ListTasks)
		r.Post("/v1/tasks", h.CreateTask)
		r.Patch("/v1/tasks/{taskId}", h.UpdateTask)
		r.Delete("/v1/tasks/{taskId}", h.DeleteTask)

		// Pomos
		r.Get("/v1/pomos", h.ListPomos)
		r.Post("/v1/pomos", h.RecordPomo)

		// Session
		r.Get("/v1/session", h.GetSession)
		r.Put("/v1/session", h.UpdateSession)

		// Reports
		r.Get("/v1/reports", h.ListReports)
		r.Post("/v1/reports", h.UpsertReport)
		r.Get("/v1/reports/{date}", h.GetReportByDate)
		r.Put("/v1/reports/{date}", h.UpsertReport)
		r.Delete("/v1/reports/{date}", h.DeleteReport)

		// AI
		r.Post("/v1/ai/voice-to-report", h.VoiceToReport)
		r.Post("/v1/ai/summary", h.AISummary)
		r.Post("/v1/ai/classify-task", h.ClassifyTask)
		r.Get("/v1/reports/auto-draft", h.AutoDraftReport)

		// Stats
		r.Get("/v1/stats/summary", h.GetStatsSummary)

		// Groups
		r.Get("/v1/groups", h.ListGroups)
		r.Post("/v1/groups", h.CreateGroup)
		r.Post("/v1/groups/join", h.JoinGroup)
		r.Get("/v1/groups/{groupId}", h.GetGroup)
		r.Get("/v1/groups/{groupId}/members", h.ListGroupMembers)
		r.Delete("/v1/groups/{groupId}/leave", h.LeaveGroup)
	})

	return r
}
