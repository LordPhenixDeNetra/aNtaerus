package httpapi

import (
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"antaerus/interfaces/gateway_go/internal/config"
	"golang.org/x/time/rate"
)

type limiterEntry struct {
	limiter  *rate.Limiter
	lastSeen time.Time
}

type RateLimiter struct {
	config         config.Config
	now            func() time.Time
	mu             sync.Mutex
	httpLimiters   map[string]*limiterEntry
	wsConnLimiters map[string]*limiterEntry
	wsMsgLimiters  map[string]*limiterEntry
}

func NewRateLimiter(cfg config.Config) *RateLimiter {
	return &RateLimiter{
		config:         cfg,
		now:            time.Now,
		httpLimiters:   map[string]*limiterEntry{},
		wsConnLimiters: map[string]*limiterEntry{},
		wsMsgLimiters:  map[string]*limiterEntry{},
	}
}

func (limiter *RateLimiter) RateLimitHTTP(next http.Handler) http.Handler {
	return http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if !limiter.AllowHTTP(request) {
			http.Error(writer, http.StatusText(http.StatusTooManyRequests), http.StatusTooManyRequests)
			return
		}

		next.ServeHTTP(writer, request)
	})
}

func (limiter *RateLimiter) AllowHTTP(request *http.Request) bool {
	key := httpLimiterKey(request)
	return limiter.allow(limiter.httpLimiters, key, rate.Limit(limiter.config.HTTPRateLimitRPS), limiter.config.HTTPRateLimitBurst)
}

func (limiter *RateLimiter) AllowWSConnect(claims Claims, ip string) bool {
	key := fmt.Sprintf("ws-connect:%s:%s", claims.Subject, ip)
	if claims.Subject == "" {
		key = fmt.Sprintf("ws-connect:%s", ip)
	}

	return limiter.allow(limiter.wsConnLimiters, key, rate.Limit(limiter.config.WSConnectRateRPS), limiter.config.WSConnectBurst)
}

func (limiter *RateLimiter) AllowWSMessage(clientID string, claims Claims) bool {
	key := fmt.Sprintf("ws-message:%s:%s", claims.Subject, clientID)
	if claims.Subject == "" {
		key = fmt.Sprintf("ws-message:%s", clientID)
	}

	return limiter.allow(limiter.wsMsgLimiters, key, rate.Limit(limiter.config.WSMessageRateRPS), limiter.config.WSMessageBurst)
}

func (limiter *RateLimiter) allow(
	store map[string]*limiterEntry,
	key string,
	rps rate.Limit,
	burst int,
) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()

	limiter.prune(store)

	entry, ok := store[key]
	if !ok {
		entry = &limiterEntry{
			limiter:  rate.NewLimiter(rps, burst),
			lastSeen: limiter.now(),
		}
		store[key] = entry
	}

	entry.lastSeen = limiter.now()
	return entry.limiter.Allow()
}

func (limiter *RateLimiter) prune(store map[string]*limiterEntry) {
	cutoff := limiter.now().Add(-5 * time.Minute)
	for key, entry := range store {
		if entry.lastSeen.Before(cutoff) {
			delete(store, key)
		}
	}
}

func httpLimiterKey(request *http.Request) string {
	if claims, ok := ClaimsFromContext(request.Context()); ok && claims.Subject != "" {
		return "http:" + claims.Subject
	}

	return "http:" + requestIP(request)
}

func requestIP(request *http.Request) string {
	host, _, err := net.SplitHostPort(request.RemoteAddr)
	if err == nil && host != "" {
		return host
	}

	return request.RemoteAddr
}
