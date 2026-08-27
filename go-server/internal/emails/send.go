// Package emails ports server/src/utils/email.ts's tiny {{key}} template
// engine and Mailgun sender. Templates are embedded at build time (instead
// of read from disk beside the binary the way the Node server does) so the
// Go binary is self-contained.
package emails

import (
	"context"
	"embed"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/mailgun/mailgun-go/v4"
)

//go:embed templates/*.html templates/partials/*.html
var templatesFS embed.FS

const (
	AdminNewOrder    = "admin-new-order"
	CustomerNewOrder = "customer-new-order"
	ForgotPassword   = "forgot-password"
	ContactMessage   = "contact-message"
	OrderHasShipped  = "order-has-shipped"
)

const defaultFrom = "Midwest Daisy <info@midwestdaisy.com>"

type templateConfig struct {
	subject string
	// GraphQL/JS-side variable name -> partial filename (without .html),
	// for variables whose value is a list of rows rather than a plain string.
	partials map[string]string
}

var templates = map[string]templateConfig{
	ContactMessage: {
		subject: "New message from your contact form",
	},
	ForgotPassword: {
		subject:  "Forgot Password",
		partials: map[string]string{"actionButton": "action-button"},
	},
	AdminNewOrder: {
		subject:  "A new order has been placed!",
		partials: map[string]string{"productList": "product-info"},
	},
	CustomerNewOrder: {
		subject:  "Thank you for your order!",
		partials: map[string]string{"productList": "product-info"},
	},
	OrderHasShipped: {
		subject:  "Your order has shipped!",
		partials: map[string]string{"productList": "product-info"},
	},
}

// Variables mirrors the TS EmailTemplateVariables type: each value is
// either a plain string, or a list of key/value rows used to expand a
// partial once per row (e.g. one row per line item in an order email).
type Variables map[string]any

func parseEmail(template string, variables Variables) (string, error) {
	cfg, ok := templates[template]
	if !ok {
		return "", fmt.Errorf("unknown email template %q", template)
	}

	htmlBytes, err := templatesFS.ReadFile("templates/" + template + ".html")
	if err != nil {
		return "", err
	}
	html := string(htmlBytes)

	for key, value := range variables {
		switch v := value.(type) {
		case string:
			html = strings.ReplaceAll(html, "{{"+key+"}}", v)

		case []map[string]string:
			partialName, ok := cfg.partials[key]
			if !ok {
				continue
			}
			partialBytes, err := templatesFS.ReadFile("templates/partials/" + partialName + ".html")
			if err != nil {
				continue
			}
			partial := string(partialBytes)

			var expanded strings.Builder
			for _, row := range v {
				item := partial
				for k, val := range row {
					item = strings.ReplaceAll(item, "{{"+k+"}}", val)
				}
				expanded.WriteString(item)
			}
			html = strings.ReplaceAll(html, "{{"+key+"}}", expanded.String())
		}
	}

	return html, nil
}

// Send renders `template` with `variables` and sends it through Mailgun to
// `recipient` (falling back to ADMIN_EMAIL, matching the Node default
// parameter `recipient = process.env.ADMIN_EMAIL`). It returns the Mailgun
// message id.
func Send(template string, variables Variables, recipient string) (string, error) {
	if recipient == "" {
		recipient = os.Getenv("ADMIN_EMAIL")
	}

	cfg, ok := templates[template]
	if !ok {
		return "", fmt.Errorf("unknown email template %q", template)
	}

	html, err := parseEmail(template, variables)
	if err != nil {
		return "", err
	}

	mg := mailgun.NewMailgun(os.Getenv("MAILGUN_DOMAIN"), os.Getenv("MAILGUN_SECRET_KEY"))
	message := mailgun.NewMessage(defaultFrom, cfg.subject, "", recipient)
	message.SetHTML(html)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, id, err := mg.Send(ctx, message)
	if err != nil {
		return "", err
	}
	return id, nil
}
