package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Base mirrors the id/createdAt/updatedAt trio every Sequelize model in the
// Node server declares (@IsUUID/@PrimaryKey/@Default(DataType.UUIDV4) plus
// the `timestamps: true, underscored: true` table options). There is no
// paranoid/soft-delete on the Node side, so there's no DeletedAt here either.
//
// The column is deliberately NOT typed `uuid`: @IsUUID(4) in the Node model
// only adds a Sequelize-side validator (see
// node_modules/sequelize-typescript/dist/validation/is-uuid.js) — it never
// sets the column's DataType. An un-annotated `@Column` on a TS `string`
// property infers DataType.STRING, so every "id" in the real database is a
// plain varchar, not a native Postgres uuid. Matching that here (rather
// than the stricter, more correct-looking `uuid` type) keeps this schema
// compatible with the existing database and avoids `text = uuid` operator
// errors in raw-SQL joins against columns that were never foreign keys
// (e.g. Analytic.ModalID) and so never got GORM's association-inferred type.
//
// Sequelize generates the UUID application-side (DataType.UUIDV4 is a JS
// default, not a Postgres one), so we match that with EnsureID below rather
// than a DB-side default expression.
type Base struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

// GetID satisfies the idModel constraint in internal/dataloaders, letting
// its generic by-id batch loader work across every model that embeds Base.
func (b *Base) GetID() string {
	return b.ID
}

// EnsureID assigns a UUID if one hasn't been set yet. Models with their own
// BeforeCreate hook (e.g. Token) call this explicitly, since defining
// BeforeCreate on the outer struct shadows the one promoted from Base.
func (b *Base) EnsureID() {
	if b.ID == "" {
		b.ID = uuid.NewString()
	}
}

func (b *Base) BeforeCreate(tx *gorm.DB) error {
	b.EnsureID()
	return nil
}
