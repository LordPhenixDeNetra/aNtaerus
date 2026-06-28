package httpapi

import (
	"fmt"
	"net/http"
	"time"

	"antaerus/gateway_go/internal/config"
	"antaerus/gateway_go/internal/system"
)

func NewServer(cfg config.Config) *http.Server {
	handlers := system.NewHandlers(cfg)

	return &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           NewMux(handlers),
		ReadHeaderTimeout: 5 * time.Second,
	}
}
