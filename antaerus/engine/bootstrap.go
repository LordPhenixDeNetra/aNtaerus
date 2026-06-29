package engine

import (
	"antaerus/interfaces/gateway_go/app"
	"antaerus/kernel/settings"
)

type RuntimeBootstrap struct {
	Settings settings.FoundationSettings
}

func NewRuntimeBootstrap() RuntimeBootstrap {
	return RuntimeBootstrap{
		Settings: settings.LoadFoundationSettings(),
	}
}

func (bootstrap RuntimeBootstrap) BuildGatewayApplication() (app.Application, error) {
	_ = bootstrap.Settings
	return app.NewApplication()
}
