package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"storeapi/internal/database"
	"storeapi/internal/logger"
	"storeapi/internal/server"

	_ "github.com/joho/godotenv/autoload"
)

func gracefulShutdown(fiberServer *server.FiberServer, done chan bool) {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	<-ctx.Done()

	logger.Info("shutting down gracefully, press Ctrl+C again to force")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := fiberServer.ShutdownWithContext(ctx); err != nil {
		logger.Error("Server forced to shutdown with error: ", "error", err)
	}

	logger.Info("Server exiting")
	done <- true
}

func main() {
	srv := server.New()
	srv.RegisterFiberRoutes()

	// Matches `await sequelize.sync()` in server/src/index.ts.
	database.AutoMigrate()

	done := make(chan bool, 1)

	go func() {
		port, _ := strconv.Atoi(os.Getenv("PORT"))
		logger.Info(fmt.Sprintf("Server started on %d", port))
		if err := srv.Listen(fmt.Sprintf(":%d", port)); err != nil {
			panic(fmt.Sprintf("http server error: %s", err))
		}
	}()

	go gracefulShutdown(srv, done)

	<-done
	logger.Info("Graceful shutdown complete.")
}
