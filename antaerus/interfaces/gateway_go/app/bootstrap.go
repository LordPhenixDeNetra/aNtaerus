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

func NewApplication() (Application, error) {
	cfg, err := config.Load()
	if err != nil {
		return Application{}, err
	}

	return Application{
		Server: httpapi.NewServer(cfg),
		Config: cfg,
	}, nil
}
