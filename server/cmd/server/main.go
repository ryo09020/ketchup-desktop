package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/ryo09020/ketchup-desktop/server/internal/ai"
	"github.com/ryo09020/ketchup-desktop/server/internal/api"
	"github.com/ryo09020/ketchup-desktop/server/internal/store"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	dbURL := os.Getenv("DATABASE_URL")
	jwtSecret := os.Getenv("SUPABASE_JWT_SECRET")
	geminiKey := os.Getenv("GEMINI_API_KEY")

	var dataStore store.Store
	ctx := context.Background()

	if dbURL != "" {
		log.Printf("Connecting to PostgreSQL at %s ...", dbURL)
		pgStore, err := store.NewPostgresStore(ctx, dbURL)
		if err != nil {
			log.Printf("WARNING: Failed to connect to PostgreSQL: %v. Falling back to in-memory store.", err)
			dataStore = store.NewMemoryStore()
		} else {
			log.Println("Connected to PostgreSQL successfully.")
			dataStore = pgStore
		}
	} else {
		log.Println("DATABASE_URL not set. Running with In-Memory store (development mode).")
		dataStore = store.NewMemoryStore()
	}

	geminiClient := ai.NewGeminiClient(geminiKey)
	handler := api.NewHandler(dataStore, geminiClient)
	router := api.NewRouter(handler, jwtSecret)

	server := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Printf("🍅 KetchUp API Server listening on http://localhost:%s", port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server gracefully...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Fatalf("Server forced shutdown: %v", err)
	}
	log.Println("Server stopped.")
}
