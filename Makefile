.PHONY: check test build frontend backend run

AXIS_GO_CACHE ?= /tmp/axis-go-cache

check: test frontend

test:
	GOCACHE=$(AXIS_GO_CACHE) go test ./...
	GOCACHE=$(AXIS_GO_CACHE) go vet ./...

frontend:
	cd frontend && npm run typecheck && npm run build

backend:
	GOCACHE=$(AXIS_GO_CACHE) go build -o /tmp/axis-server ./backend/cmd/server

build: frontend backend

run:
	GOCACHE=$(AXIS_GO_CACHE) go run ./backend/cmd/server
