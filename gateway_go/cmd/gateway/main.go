package main

import (
	"log"

	httpapi "antaerus/gateway_go/internal/http"
	"antaerus/gateway_go/internal/config"
)

func main() {
	cfg := config.Load()
	server := httpapi.NewServer(cfg)

	log.Printf("starting gateway_go on :%d", cfg.Port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
