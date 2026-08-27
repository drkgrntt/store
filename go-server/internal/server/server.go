package server

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"storeapi/internal/database"
)

type FiberServer struct {
	*fiber.App

	db *database.Service
}

func New() *FiberServer {
	time.Local = time.UTC

	server := &FiberServer{
		App: fiber.New(fiber.Config{
			ServerHeader: "storeapi",
			AppName:      "storeapi",
		}),

		db: database.New(),
	}

	return server
}
