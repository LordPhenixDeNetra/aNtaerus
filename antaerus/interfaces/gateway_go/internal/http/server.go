package httpapi

import (
	"errors"
	"fmt"
	"net/http"

	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/system"
)

var (
	listenAndServe = func(server *http.Server) error {
		return server.ListenAndServe()
	}
	listenAndServeTLS = func(server *http.Server, certFile string, keyFile string) error {
		return server.ListenAndServeTLS(certFile, keyFile)
	}
)

func NewServer(cfg config.Config) *http.Server {
	handlers := system.NewHandlers(cfg)

	return &http.Server{
		Addr:              fmt.Sprintf(":%d", cfg.Port),
		Handler:           NewMux(handlers),
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		IdleTimeout:       cfg.IdleTimeout,
		WriteTimeout:      cfg.WriteTimeout,
	}
}

func Listen(server *http.Server, cfg config.Config) error {
	var err error
	if cfg.HasTLS() {
		err = listenAndServeTLS(server, cfg.TLSCertFile, cfg.TLSKeyFile)
	} else {
		err = listenAndServe(server)
	}

	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}

	return err
}
