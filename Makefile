.PHONY: setup dev desktop.dev desktop.run desktop.build desktop.web server.dev db.start db.stop lint test clean

setup:
	pnpm install
	cd server && go mod tidy

dev: desktop.dev

desktop.dev:
	cd apps/desktop && pnpm tauri dev

desktop.run:
	./apps/desktop/src-tauri/target/debug/ketchup-desktop

desktop.build:
	cd apps/desktop && pnpm tauri build

desktop.web:
	cd apps/desktop && pnpm vite

server.dev:
	cd server && go run cmd/server/main.go

db.start:
	supabase start

db.stop:
	supabase stop

lint:
	pnpm -F desktop lint
	cd server && go vet ./...

test:
	pnpm -F desktop test
	cd server && go test ./...
