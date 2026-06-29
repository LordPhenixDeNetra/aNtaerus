package config

import (
	"errors"
	"fmt"
	"net/url"
	"os"
	"time"

	"antaerus/kernel/settings"
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
	defaultJWTSecret           = "development-gateway-jwt-secret"
	defaultJWTIssuer           = "antaerus.gateway"
	defaultJWTAudience         = "antaerus.web"
	defaultJWTTokenTTLMS       = 3600000
	defaultWSHeartbeatMS       = 30000
	defaultHTTPRateLimitRPS    = 10.0
	defaultHTTPRateLimitBurst  = 20
	defaultWSConnectRateRPS    = 2.0
	defaultWSConnectBurst      = 5
	defaultWSMessageRateRPS    = 20.0
	defaultWSMessageBurst      = 40
)

type Config struct {
	Environment        string
	Port               int
	Version            string
	WebURL             string
	BrainBaseURL       string
	EngineHTTPURL      string
	EngineGRPCTarget   string
	RequestTimeout     time.Duration
	ReadHeaderTimeout  time.Duration
	ShutdownTimeout    time.Duration
	IdleTimeout        time.Duration
	WriteTimeout       time.Duration
	TLSCertFile        string
	TLSKeyFile         string
	JWTSecret          settings.SecretString
	JWTIssuer          string
	JWTAudience        string
	JWTTokenTTL        time.Duration
	WSHeartbeat        time.Duration
	HTTPRateLimitRPS   float64
	HTTPRateLimitBurst int
	WSConnectRateRPS   float64
	WSConnectBurst     int
	WSMessageRateRPS   float64
	WSMessageBurst     int
}

func Load() (Config, error) {
	v := viper.New()
	v.SetConfigFile(".env")
	v.SetConfigType("env")
	v.AutomaticEnv()

	v.SetDefault("ANTAERUS_ENV", defaultEnvironment)
	v.SetDefault("ANTAERUS_GATEWAY_PORT", defaultGatewayPort)
	v.SetDefault("ANTAERUS_GATEWAY_VERSION", defaultGatewayVersion)
	v.SetDefault("ANTAERUS_WEB_URL", defaultWebURL)
	v.SetDefault("ANTAERUS_BRAIN_URL", defaultBrainBaseURL)
	v.SetDefault("ANTAERUS_ENGINE_URL", defaultEngineHTTPURL)
	v.SetDefault("ANTAERUS_ENGINE_GRPC_TARGET", defaultEngineGRPCTarget)
	v.SetDefault("ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS", defaultRequestTimeoutMS)
	v.SetDefault("ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS", defaultReadHeaderTimeoutMS)
	v.SetDefault("ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS", defaultShutdownTimeoutMS)
	v.SetDefault("ANTAERUS_GATEWAY_IDLE_TIMEOUT_MS", defaultIdleTimeoutMS)
	v.SetDefault("ANTAERUS_GATEWAY_WRITE_TIMEOUT_MS", defaultWriteTimeoutMS)
	v.SetDefault("ANTAERUS_GATEWAY_JWT_SECRET", defaultJWTSecret)
	v.SetDefault("ANTAERUS_GATEWAY_JWT_ISSUER", defaultJWTIssuer)
	v.SetDefault("ANTAERUS_GATEWAY_JWT_AUDIENCE", defaultJWTAudience)
	v.SetDefault("ANTAERUS_GATEWAY_JWT_TOKEN_TTL_MS", defaultJWTTokenTTLMS)
	v.SetDefault("ANTAERUS_GATEWAY_WS_HEARTBEAT_INTERVAL_MS", defaultWSHeartbeatMS)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_HTTP_RPS", defaultHTTPRateLimitRPS)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_HTTP_BURST", defaultHTTPRateLimitBurst)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_WS_CONNECT_RPS", defaultWSConnectRateRPS)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_WS_CONNECT_BURST", defaultWSConnectBurst)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_WS_MESSAGE_RPS", defaultWSMessageRateRPS)
	v.SetDefault("ANTAERUS_GATEWAY_RATE_LIMIT_WS_MESSAGE_BURST", defaultWSMessageBurst)

	if err := v.ReadInConfig(); err != nil {
		var configNotFound viper.ConfigFileNotFoundError
		if !errors.As(err, &configNotFound) && !os.IsNotExist(err) {
			return Config{}, fmt.Errorf("read gateway config: %w", err)
		}
	}

	cfg := Config{
		Environment:        v.GetString("ANTAERUS_ENV"),
		Port:               v.GetInt("ANTAERUS_GATEWAY_PORT"),
		Version:            v.GetString("ANTAERUS_GATEWAY_VERSION"),
		WebURL:             v.GetString("ANTAERUS_WEB_URL"),
		BrainBaseURL:       v.GetString("ANTAERUS_BRAIN_URL"),
		EngineHTTPURL:      v.GetString("ANTAERUS_ENGINE_URL"),
		EngineGRPCTarget:   v.GetString("ANTAERUS_ENGINE_GRPC_TARGET"),
		RequestTimeout:     durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_REQUEST_TIMEOUT_MS")),
		ReadHeaderTimeout:  durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_READ_HEADER_TIMEOUT_MS")),
		ShutdownTimeout:    durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_SHUTDOWN_TIMEOUT_MS")),
		IdleTimeout:        durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_IDLE_TIMEOUT_MS")),
		WriteTimeout:       durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_WRITE_TIMEOUT_MS")),
		TLSCertFile:        v.GetString("ANTAERUS_GATEWAY_TLS_CERT_FILE"),
		TLSKeyFile:         v.GetString("ANTAERUS_GATEWAY_TLS_KEY_FILE"),
		JWTSecret:          settings.SecretString(v.GetString("ANTAERUS_GATEWAY_JWT_SECRET")),
		JWTIssuer:          v.GetString("ANTAERUS_GATEWAY_JWT_ISSUER"),
		JWTAudience:        v.GetString("ANTAERUS_GATEWAY_JWT_AUDIENCE"),
		JWTTokenTTL:        durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_JWT_TOKEN_TTL_MS")),
		WSHeartbeat:        durationFromMilliseconds(v.GetInt("ANTAERUS_GATEWAY_WS_HEARTBEAT_INTERVAL_MS")),
		HTTPRateLimitRPS:   v.GetFloat64("ANTAERUS_GATEWAY_RATE_LIMIT_HTTP_RPS"),
		HTTPRateLimitBurst: v.GetInt("ANTAERUS_GATEWAY_RATE_LIMIT_HTTP_BURST"),
		WSConnectRateRPS:   v.GetFloat64("ANTAERUS_GATEWAY_RATE_LIMIT_WS_CONNECT_RPS"),
		WSConnectBurst:     v.GetInt("ANTAERUS_GATEWAY_RATE_LIMIT_WS_CONNECT_BURST"),
		WSMessageRateRPS:   v.GetFloat64("ANTAERUS_GATEWAY_RATE_LIMIT_WS_MESSAGE_RPS"),
		WSMessageBurst:     v.GetInt("ANTAERUS_GATEWAY_RATE_LIMIT_WS_MESSAGE_BURST"),
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

	if cfg.JWTSecret.Value() == "" {
		return errors.New("ANTAERUS_GATEWAY_JWT_SECRET must not be empty")
	}

	if cfg.JWTIssuer == "" {
		return errors.New("ANTAERUS_GATEWAY_JWT_ISSUER must not be empty")
	}

	if cfg.JWTAudience == "" {
		return errors.New("ANTAERUS_GATEWAY_JWT_AUDIENCE must not be empty")
	}

	if cfg.JWTTokenTTL <= 0 {
		return fmt.Errorf("JWT token TTL must be greater than zero: %s", cfg.JWTTokenTTL)
	}

	if cfg.WSHeartbeat <= 0 {
		return fmt.Errorf("WebSocket heartbeat interval must be greater than zero: %s", cfg.WSHeartbeat)
	}

	if cfg.HTTPRateLimitRPS <= 0 || cfg.HTTPRateLimitBurst <= 0 {
		return errors.New("HTTP rate limit configuration must be greater than zero")
	}

	if cfg.WSConnectRateRPS <= 0 || cfg.WSConnectBurst <= 0 {
		return errors.New("WebSocket connect rate limit configuration must be greater than zero")
	}

	if cfg.WSMessageRateRPS <= 0 || cfg.WSMessageBurst <= 0 {
		return errors.New("WebSocket message rate limit configuration must be greater than zero")
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
