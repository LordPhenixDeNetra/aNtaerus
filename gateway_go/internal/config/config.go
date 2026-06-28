package config

import (
	"os"
	"strconv"
)

type Config struct {
	Environment string
	Port        int
	WebURL      string
	PythonURL   string
	RustURL     string
	Version     string
}

func Load() Config {
	return Config{
		Environment: getEnv("ANTAERUS_ENV", "development"),
		Port:        getEnvAsInt("ANTAERUS_GATEWAY_PORT", 8080),
		WebURL:      getEnv("ANTAERUS_WEB_URL", "http://localhost:5173"),
		PythonURL:   getEnv("ANTAERUS_BRAIN_URL", "http://localhost:8000"),
		RustURL:     getEnv("ANTAERUS_ENGINE_URL", "http://localhost:7000"),
		Version:     getEnv("ANTAERUS_GATEWAY_VERSION", "0.1.0"),
	}
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}

	return fallback
}

func getEnvAsInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}

	return parsed
}
