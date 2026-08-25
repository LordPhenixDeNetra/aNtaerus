package httpapi

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/config"
	"antaerus/interfaces/gateway_go/internal/contracts"
	"antaerus/interfaces/gateway_go/internal/scheduler"
	"antaerus/interfaces/gateway_go/internal/system"
)

var webDistDirCandidates = []string{
	filepath.Join("antaerus", "interfaces", "web", "dist"),
	filepath.Join("..", "web", "dist"),
	"dist",
}

func NewMux(cfg config.Config, handlers system.Handlers) *http.ServeMux {
	return newMux(cfg, handlers, newDefaultVoiceRuntimeFactory(cfg.EngineGRPCTarget))
}

func newMux(
	cfg config.Config,
	handlers system.Handlers,
	voiceFactory voiceRuntimeFactory,
) *http.ServeMux {
	mux := http.NewServeMux()
	apiMux := http.NewServeMux()
	healthHTTPClient := &http.Client{Timeout: cfg.RequestTimeout}
	chatHTTPClient := &http.Client{Timeout: cfg.WriteTimeout}
	missionHTTPClient := &http.Client{Timeout: cfg.WriteTimeout}
	proactiveHTTPClient := &http.Client{Timeout: cfg.WriteTimeout}
	memoryHTTPClient := &http.Client{Timeout: cfg.WriteTimeout}
	healthService := system.NewHealthService(cfg, healthHTTPClient)
	authenticator := NewAuthenticator(cfg)
	rateLimiter := NewRateLimiter(cfg)
	brainChat := clients.NewBrainChatClient(chatHTTPClient, cfg.BrainBaseURL, cfg.WriteTimeout)
	missionClient := clients.NewBrainMissionClient(missionHTTPClient, cfg.BrainBaseURL, cfg.WriteTimeout)
	proactiveClient := clients.NewBrainProactiveClient(proactiveHTTPClient, cfg.BrainBaseURL, cfg.WriteTimeout)
	memoryClient := clients.NewBrainMemoryClient(memoryHTTPClient, cfg.BrainBaseURL, cfg.WriteTimeout)
	hub := NewHub(cfg, authenticator, rateLimiter, brainChat, voiceFactory, healthService)
	missionHandlers := NewMissionHandlers(missionClient, hub)
	proactiveHandlers := NewProactiveHandlers(proactiveClient, hub)
	memoryHandlers := NewMemoryHandlers(cfg, memoryClient)
	analyticsHandlers := NewAnalyticsHandlers(cfg, memoryClient)
	configHandlers := NewConfigHandlers(cfg, memoryClient)
	systemPlus := NewSystemHandlersPlus(cfg, handlers)
	proactiveBroadcast := func(msg contracts.ServerMessage) {
		select {
		case hub.broadcast <- msg:
		default:
		}
	}
	proactiveScheduler := scheduler.NewCronScheduler(
		proactiveClient,
		proactiveBroadcast,
		60*time.Second,
		cfg.ProactiveCronHour,
	)
	proactiveScheduler.Start()

	mux.HandleFunc("/health", handlers.HandleHealth)
	apiMux.HandleFunc("/api/v1/health", handlers.HandleAggregatedHealth)
	apiMux.HandleFunc("/api/v1/system/", systemPlus.ServeHTTP)
	apiMux.HandleFunc("/api/v1/auth/dev-token", NewDevTokenHandler(cfg, authenticator))
	apiMux.HandleFunc("/api/v1/chat/sessions/", NewChatHistoryHandler(brainChat))
	apiMux.HandleFunc("/api/v1/ws", hub.ServeWS)
	apiMux.HandleFunc("/api/v1/missions", missionHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/missions/", missionHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/proactive", proactiveHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/proactive/", proactiveHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/memory", memoryHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/memory/", memoryHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/analytics", analyticsHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/analytics/", analyticsHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/config", configHandlers.ServeHTTP)
	apiMux.HandleFunc("/api/v1/config/", configHandlers.ServeHTTP)
	mux.Handle("/api/", withCORS(cfg, apiMux))

	if staticHandler := newFrontendStaticHandler(); staticHandler != nil {
		mux.Handle("/", staticHandler)
	}

	return mux
}

func newFrontendStaticHandler() http.Handler {
	distDir, ok := findWebDistDir()
	if !ok {
		return nil
	}

	fileServer := http.FileServer(http.Dir(distDir))
	indexFile := filepath.Join(distDir, "index.html")

	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodGet && request.Method != http.MethodHead {
			http.NotFound(writer, request)
			return
		}

		trimmedPath := strings.TrimPrefix(request.URL.Path, "/")
		if trimmedPath == "" {
			http.ServeFile(writer, request, indexFile)
			return
		}

		cleanPath := filepath.Clean(trimmedPath)
		if strings.HasPrefix(cleanPath, "..") {
			http.NotFound(writer, request)
			return
		}

		filePath := filepath.Join(distDir, cleanPath)
		info, err := os.Stat(filePath)
		if err == nil && !info.IsDir() {
			fileServer.ServeHTTP(writer, request)
			return
		}

		http.ServeFile(writer, request, indexFile)
	})
}

func findWebDistDir() (string, bool) {
	for _, candidate := range webDistDirCandidates {
		indexPath := filepath.Join(candidate, "index.html")
		if info, err := os.Stat(indexPath); err == nil && !info.IsDir() {
			return candidate, true
		}
	}

	return "", false
}

func withCORS(cfg config.Config, next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		origin := strings.TrimSpace(request.Header.Get("Origin"))
		if origin == "" {
			next.ServeHTTP(writer, request)
			return
		}

		if !isAllowedOrigin(cfg, request, origin) {
			if request.Method == http.MethodOptions {
				http.Error(writer, http.StatusText(http.StatusForbidden), http.StatusForbidden)
				return
			}

			next.ServeHTTP(writer, request)
			return
		}

		headers := writer.Header()
		headers.Set("Access-Control-Allow-Origin", origin)
		headers.Add("Vary", "Origin")
		headers.Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		headers.Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

		if request.Method == http.MethodOptions {
			writer.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(writer, request)
	})
}

func isAllowedOrigin(cfg config.Config, request *http.Request, origin string) bool {
	if origin == cfg.WebURL || origin == cfg.GatewayURL() {
		return true
	}

	scheme := "http"
	if request.TLS != nil {
		scheme = "https"
	}

	return origin == fmt.Sprintf("%s://%s", scheme, request.Host)
}
