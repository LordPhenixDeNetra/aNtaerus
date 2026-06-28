package app

import (
	"net/http"

	"antaerus/interfaces/gateway_go/internal/config"
	httpapi "antaerus/interfaces/gateway_go/internal/http"
)

type Application struct {
	Server *http.Server
	Config config.Config
}

func NewApplication() Application {
	cfg := config.Load()

	return Application{
		Server: httpapi.NewServer(cfg),
		Config: cfg,
	}
}

