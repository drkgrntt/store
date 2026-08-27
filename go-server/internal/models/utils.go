package models

import "sync"

// Every model registers itself here via an init() in its own file (see
// user.go, token.go, ...), the same way the Node server lists its models
// in server/src/index.ts's `models: [...]` array for sequelize.sync().
// database.AutoMigrate() reads this list to keep the schema in sync.
var (
	modelsMux sync.Mutex
	models    []any
)

func registerModel(model any) {
	modelsMux.Lock()
	defer modelsMux.Unlock()
	models = append(models, model)
}

func GetModels() []any {
	return models
}
