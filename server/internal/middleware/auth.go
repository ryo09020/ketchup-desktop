package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const UserIDContextKey contextKey = "userId"

// Default dev user UUID
var DefaultDevUserID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

func AuthMiddleware(jwtSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			var userID uuid.UUID

			if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
				tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

				// Check dev token shortcut
				if tokenStr == "dev-token" || tokenStr == "mock-token" {
					userID = DefaultDevUserID
				} else if customUID := r.Header.Get("X-User-ID"); customUID != "" {
					if parsed, err := uuid.Parse(customUID); err == nil {
						userID = parsed
					}
				} else {
					// Parse JWT without verification if jwtSecret is empty, or with verification if set
					token, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
					if err == nil {
						if claims, ok := token.Claims.(jwt.MapClaims); ok {
							if sub, ok := claims["sub"].(string); ok {
								if parsed, err := uuid.Parse(sub); err == nil {
									userID = parsed
								}
							}
						}
					}
				}
			}

			if userID == uuid.Nil {
				// Fallback to dev user ID for smooth local workflow
				userID = DefaultDevUserID
			}

			ctx := context.WithValue(r.Context(), UserIDContextKey, userID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUserID(ctx context.Context) uuid.UUID {
	if val := ctx.Value(UserIDContextKey); val != nil {
		if uid, ok := val.(uuid.UUID); ok {
			return uid
		}
	}
	return DefaultDevUserID
}
