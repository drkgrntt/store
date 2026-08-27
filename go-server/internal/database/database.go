package database

import (
	"context"
	"fmt"
	"log"
	"os"
	"strconv"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"storeapi/internal/models"

	_ "github.com/jackc/pgx/v5/stdlib"
	_ "github.com/joho/godotenv/autoload"
)

type Service struct {
	DB *gorm.DB
}

var dbInstance *Service

// New opens (or reuses) the connection to Postgres, matching the single
// DATABASE_URL the Node server has always used.
func New() *Service {
	if dbInstance != nil {
		return dbInstance
	}

	connStr := os.Getenv("DATABASE_URL")

	logMode := logger.Info
	if os.Getenv("NODE_ENV") == "production" {
		logMode = logger.Silent
	}

	db, err := gorm.Open(postgres.Open(connStr), &gorm.Config{
		Logger: logger.Default.LogMode(logMode),
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		log.Fatal(err)
	}

	// database/sql's own defaults (2 idle, unlimited open) let the pool
	// shrink back to 2 connections between bursts, so any request past
	// that under concurrent load pays a fresh TCP+auth handshake instead
	// of reusing one — Sequelize's pool doesn't shrink this aggressively,
	// and this gap showed up directly as latency in a side-by-side
	// benchmark against the Node server before it was set explicitly.
	if sqlDB, err := db.DB(); err == nil {
		sqlDB.SetMaxOpenConns(25)
		sqlDB.SetMaxIdleConns(25)
		sqlDB.SetConnMaxIdleTime(5 * time.Minute)
	}

	dbInstance = &Service{DB: db}
	return dbInstance
}

// AutoMigrate stands in for the Node server's `sequelize.sync()` call: it
// keeps the schema in sync with the model definitions on every boot.
func AutoMigrate() {
	if err := dbInstance.DB.AutoMigrate(models.GetModels()...); err != nil {
		log.Fatal(err)
	}
}

// Health checks the health of the database connection by pinging it.
func (s *Service) Health() map[string]string {
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()

	stats := make(map[string]string)

	sqlDb, err := s.DB.DB()
	if err != nil {
		stats["status"] = "down"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		return stats
	}

	if err := sqlDb.PingContext(ctx); err != nil {
		stats["status"] = "down"
		stats["error"] = fmt.Sprintf("db down: %v", err)
		return stats
	}

	stats["status"] = "up"
	stats["message"] = "It's healthy"

	dbStats := sqlDb.Stats()
	stats["open_connections"] = strconv.Itoa(dbStats.OpenConnections)
	stats["in_use"] = strconv.Itoa(dbStats.InUse)
	stats["idle"] = strconv.Itoa(dbStats.Idle)

	return stats
}

// Close closes the database connection.
func (s *Service) Close() error {
	sqlDb, err := s.DB.DB()
	if err != nil {
		return err
	}
	return sqlDb.Close()
}
