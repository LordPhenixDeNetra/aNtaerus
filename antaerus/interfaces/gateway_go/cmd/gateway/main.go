package main

import (
	"log"

	"antaerus/engine"
	httpapi "antaerus/interfaces/gateway_go/internal/http"
)

func main() {
	bootstrap := engine.NewRuntimeBootstrap()
	application, err := bootstrap.BuildGatewayApplication()
	if err != nil {
		log.Fatal(err)
	}

	log.Printf("starting gateway_go on :%d", application.Config.Port)
	if err := httpapi.Listen(application.Server, application.Config); err != nil {
		log.Fatal(err)
	}
}
