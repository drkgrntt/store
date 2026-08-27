package graph

// This file will not be regenerated automatically.
//
// It serves as dependency injection for your app, add any dependencies you require here.

import "gorm.io/gorm"

type Resolver struct {
	DB *gorm.DB
}

// tokenDaysValid matches Token.generate's default `daysValid: number = 30`
// used by register/login/logoutEverywhere in server/src/resolvers/user.ts.
const tokenDaysValid = 30

// resetTokenDaysValid matches the `undefined, 1` passed by forgotPassword.
const resetTokenDaysValid = 1
