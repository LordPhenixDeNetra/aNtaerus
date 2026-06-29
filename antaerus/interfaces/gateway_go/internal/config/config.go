package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"time"

	"github.com/spf13/viper"
)

const (
	defaultEnvironment         = "development"
	defaultGatewayPort         = 8080
	defaultGatewayVersion      = "0.1.0"
	defaultWebURL              = "http://localhost:5173"
	defaultBrainBaseURL        = "http://localhost:8000"
	defaultEngineHTTPURL       = "http://localhost:7000"
	defaultEngineGRPCTarget    = "localhost:7001"
	defaultRequestTimeoutMS    = 2000
	defaultReadHeaderTimeoutMS = 5000
	defaultShutdownTimeoutMS   = 10000
	defaultIdleTimeoutMS       = 30000
	defaultWriteTimeoutMS      = 30000
)

type Config struct {
	Environment       string
	Port              int
	Version           string
	WebURL            string
	BrainBaseURL      string
	EngineHTTPURL     string
	EngineGRPCTarget  string
	RequestTimeout    time.Duration
	ReadHeaderTimeout time.Duration
	ShutdownTimeout   time.Duration
	IdleTimeout       time.Duration
	WriteTimeout      time.Duration
	TLSCertFile       string
	TLSKeyFile        string
}

func Load() (Config, error) {
	settings := viper.New()
	settings.SetConfigFile(".env")
	settings.SetConfigType("env")
	settings.AutomaticEnv()

	settings.SetDefault("ANTAERUS_ENV", defaultEnvironment)
	settings.SetDefault("ANTAERUS_GATEWAY_PORT", defaultGatewayPort)
	settings.SetDefault("ANTAERUS_GATEWAY_VERSION", defaultGatewayVersion)
	settings.SetDefault("ANTAERUS_WEB_URL", defaultWebURL)
	settings.SetDefault("ANTAERUS_BRAIN_URL", defaultBrainBaseURL)
	settings.SetDefault("ANTAERUS_ENGINE_URL", defaultEngineHTTPURL)
	settings.SetDefault("ANTAERUS_ENGINE_GRPC_TARGET", defaultEngineGRPCTarget)
	settings.SetDefault("ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS", defaultRequestTimeoutMS)
	settings.SetDefault("ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS", defaultReadHeaderTimeoutMS)
	settings.SetDefault("ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS", defaultShutdownTimeoutMS)
	settings.SetDefault("ANTAERUS_GATEWAY_IDLE_TIMEOUT_MS", defaultIdleTimeoutMS)
	settings.SetDefault("ANTAERUS_GATEWAY_WRITE_TIMEOUT_MS", defaultWriteTimeoutMS)

	if err := settings.ReadInConfig(); err != nil {
		var configNotFound viper.ConfigFileNotFoundError
		if !errors.As(err, &configNotFound) && !os.IsNotExist(err) {
			return Config{}, fmt.Errorf("read gateway config: %w", err)
		}
	}

	cfg := Config{
		Environment:       settings.GetString("ANTAERUS_ENV"),
		Port:              settings.GetInt("ANTAERUS_GATEWAY_PORT"),
		Version:           settings.GetString("ANTAERUS_GATEWAY_VERSION"),
		WebURL:            settings.GetString("ANTAERUS_WEB_URL"),
		BrainBaseURL:      settings.GetString("ANTAERUS_BRAIN_URL"),
		EngineHTTPURL:     settings.GetString("ANTAERUS_ENGINE_URL"),
		EngineGRPCTarget:  settings.GetString("ANTAERUS_ENGINE_GRPC_TARGET"),
		RequestTimeout:    durationFromMilliseconds(settings.GetInt("ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS")),
		ReadHeaderTimeout: durationFromMilliseconds(settings.GetInt("ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS")),
		ShutdownTimeout:   durationFromMilliseconds(settings.GetInt("ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS")),
		IdleTimeout:       durationFromMilliseconds(settings.GetInt("ANTAERUS_GATEWAY_IDLE_TIMEOUT_MS")),
		WriteTimeout:      durationFromMilliseconds(settings.GetInt("ANTAERUS_GATEWAY_WRITE_TIMEOUT_MS")),
		TLSCertFile:       settings.GetString("ANTAERUS_GATEWAY_TLS_CERT_FILE"),
		TLSKeyFile:        settings.GetString("ANTAERUS_GATEWAY_TLS_KEY_FILE"),
	}

	if err := cfg.Validate(); err != nil {
		return Config{}, err
	}

	return cfg, nil
}

func (cfg Config) Validate() error {
	if cfg.Port <= 0 {
		return fmt.Errorf("gateway port must be greater than zero: %d", cfg.Port)
	}

	if err := requireHTTPURL("ANTAERUS_WEB_URL", cfg.WebURL); err != nil {
		return err
	}

	if err := requireHTTPURL("ANTAERUS_BRAIN_URL", cfg.BrainBaseURL); err != nil {
		return err
	}

	if err := requireHTTPURL("ANTAERUS_ENGINE_URL", cfg.EngineHTTPURL); err != nil {
		return err
	}

	if cfg.EngineGRPCTarget == "" {
		return errors.New("ANTAERUS_ENGINE_GRPC_TARGET must not be empty")
	}

	if cfg.RequestTimeout <= 0 {
		return fmt.Errorf("request timeout must be greater than zero: %s", cfg.RequestTimeout)
	}

	if cfg.ReadHeaderTimeout <= 0 {
		return fmt.Errorf("read header timeout must be greater than zero: %s", cfg.ReadHeaderTimeout)
	}

	if cfg.ShutdownTimeout <= 0 {
		return fmt.Errorf("shutdown timeout must be greater than zero: %s", cfg.ShutdownTimeout)
	}

	if cfg.IdleTimeout <= 0 {
		return fmt.Errorf("idle timeout must be greater than zero: %s", cfg.IdleTimeout)
	}

	if cfg.WriteTimeout <= 0 {
		return fmt.Errorf("write timeout must be greater than zero: %s", cfg.WriteTimeout)
	}

	if (cfg.TLSCertFile == "") != (cfg.TLSKeyFile == "") {
		return errors.New("TLS configuration requires both certificate and key files")
	}

	return nil
}

func (cfg Config) HasTLS() bool {
	return cfg.TLSCertFile != "" && cfg.TLSKeyFile != ""
}

func (cfg Config) GatewayURL() string {
	scheme := "http"
	if cfg.HasTLS() {
		scheme = "https"
	}

	return fmt.Sprintf("%s://localhost:%d", scheme, cfg.Port)
}

func durationFromMilliseconds(value int) time.Duration {
	return time.Duration(value) * time.Millisecond
}

func requireHTTPURL(name string, raw string) error {
	parsed, err := url.Parse(raw)
	if err != nil {
		return fmt.Errorf("%s must be a valid URL: %w", name, err)
	}

	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return fmt.Errorf("%s must use http or https: %s", name, raw)
	}

	if parsed.Host == "" {
		return fmt.Errorf("%s must include a host: %s", name, raw)
	}

	return nil
}
