package main

import (
	"log"

	"antaerus/engine"
)

func main() {
	bootstrap := engine.NewRuntimeBootstrap()
	application := bootstrap.BuildGatewayApplication()

	log.Printf("starting gateway_go on :%d", application.Config.Port)
	if err := application.Server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}

