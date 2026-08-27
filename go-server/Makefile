# Simple Makefile for a Go project

# Build the application
all: build test

# Regenerate GraphQL server/model code from internal/graph/schema/*.graphqls.
# gqlgen is a go.mod tool dependency (see tools.go), not a separately
# installed binary like templ/air in the sibling repos, so there's nothing
# to check for or offer to install — `go run` resolves it from the module
# cache directly.
generate:
	@echo "Generating GraphQL code..."
	@go run github.com/99designs/gqlgen generate

build: generate
	@echo "Building..."
	@go build -o main ./cmd/api

# Run the application
run: generate
	@go run ./cmd/api

# Test the application
test:
	@echo "Testing..."
	@go test ./... -v

# Integration tests for the application (the DB-backed tests in
# internal/models — see internal/models/db_test.go). Needs a real Postgres
# reachable at TEST_DATABASE_URL; skips gracefully if that's unset.
itest:
	@echo "Running integration tests..."
	@go test ./internal/models -v

# Clean the binary
clean:
	@echo "Cleaning..."
	@rm -f main

# Live Reload
watch:
	@if command -v air > /dev/null; then \
            air; \
            echo "Watching...";\
        else \
            read -p "Go's 'air' is not installed on your machine. Do you want to install it? [Y/n] " choice; \
            if [ "$$choice" != "n" ] && [ "$$choice" != "N" ]; then \
                go install github.com/air-verse/air@latest; \
                air; \
                echo "Watching...";\
            else \
                echo "You chose not to install air. Exiting..."; \
                exit 1; \
            fi; \
        fi

.PHONY: all build run test itest clean watch generate
