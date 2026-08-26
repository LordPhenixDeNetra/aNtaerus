package httpapi

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"
)

type BrainProxyHandlers struct {
	// Reverse proxy that forwards requests with:
	//   - /api/v1/PREFIX -> /PREFIX on the brain.
	// Headers (Authorization, Content-Type, Accept, etc.) + body are forwarded as-is.
	// Status codes + response bodies are streamed back.
	byPrefix map[string]*httputil.ReverseProxy
	// Per-prefix timeout (for net.Dial context + client.Transport).
	perPrefixTimeout map[string]time.Duration
	brainBaseURL     string
}

// NewBrainProxyHandlers creates a generic reverse proxy that maps
//   - pattern /api/v1/<prefix>(/*) -> brain /<prefix>(/*)
//
// timeoutByPrefixKey (key == <prefix>) controls the total request timeout
// for that upstream. If empty fallbackTimeout is used.
func NewBrainProxyHandlers(
	brainBaseURL string,
	fallbackTimeout time.Duration,
	timeoutByPrefixKey map[string]time.Duration,
) *BrainProxyHandlers {
	if timeoutByPrefixKey == nil {
		timeoutByPrefixKey = map[string]time.Duration{}
	}
	byPrefix := map[string]*httputil.ReverseProxy{}
	perPrefixTimeout := map[string]time.Duration{}
	target, _ := url.Parse(strings.TrimRight(brainBaseURL, "/"))
	if target == nil {
		// Defensive, shouldn't happen since valid URL provided in cfg.
		target = &url.URL{Scheme: "http", Host: "127.0.0.1:5050"}
	}
	for prefix, tout := range timeoutByPrefixKey {
		perPrefixTimeout[prefix] = tout
	}
	_ = byPrefix // allow direct ServeHTTP prefix logic below
	return &BrainProxyHandlers{
		byPrefix:         map[string]*httputil.ReverseProxy{},
		perPrefixTimeout: perPrefixTimeout,
		brainBaseURL:     strings.TrimRight(brainBaseURL, "/"),
	}
}

// ServeTools proxies /api/v1/tools[/*] to brain /tools[/*].
// This is the single handler wired into routes.go for both "/api/v1/tools"
// and "/api/v1/tools/".
func (h *BrainProxyHandlers) ServeTools(writer http.ResponseWriter, request *http.Request) {
	h.serveForPrefix("tools", writer, request)
}

// serveForPrefix dynamically builds a ReverseProxy for the requested prefix
// and forwards the request. We use httputil.ReverseProxy + custom Director
// to rewrite the path by stripping "/api/v1/<prefix>".
func (h *BrainProxyHandlers) serveForPrefix(
	prefix string,
	writer http.ResponseWriter,
	request *http.Request,
) {
	gwPrefix := "/api/v1/" + prefix

	// 1) Validate prefix and compute rewritten upstream path
	path := request.URL.Path
	if !strings.HasPrefix(path, gwPrefix) {
		http.Error(writer, fmt.Sprintf("expected path prefix %s, got %s", gwPrefix, path), http.StatusBadRequest)
		return
	}
	upstreamPath := strings.TrimPrefix(path, gwPrefix)
	if upstreamPath == "" || !strings.HasPrefix(upstreamPath, "/") {
		upstreamPath = "/" + upstreamPath
	}

	// 2) Create / cache reverse proxy for this prefix
	if _, ok := h.byPrefix[prefix]; !ok {
		target, _ := url.Parse(h.brainBaseURL)
		if target == nil {
			http.Error(writer, "invalid brain base url", http.StatusInternalServerError)
			return
		}
		timeout, ok := h.perPrefixTimeout[prefix]
		if !ok || timeout <= 0 {
			timeout = 30 * time.Second
		}
		transport := &http.Transport{
			Proxy:                 http.ProxyFromEnvironment,
			ForceAttemptHTTP2:     true,
			MaxIdleConns:          16,
			IdleConnTimeout:       60 * time.Second,
			TLSHandshakeTimeout:   10 * time.Second,
			ExpectContinueTimeout: 1 * time.Second,
		}
		client := &http.Client{
			Timeout:   timeout,
			Transport: transport,
		}
		rp := httputil.NewSingleHostReverseProxy(target)
		rp.Transport = client.Transport
		originalDirector := rp.Director
		rp.Director = func(req *http.Request) {
			originalDirector(req)
			req.URL.Path = upstreamPath
			// Carry the query string as-is.
			req.URL.RawQuery = request.URL.RawQuery
			// Preserve host for forwarding.
			req.Host = target.Host
			if req.Header == nil {
				req.Header = http.Header{}
			}
			// X-Forwarded-For chain.
			if prior, ok := request.Header["X-Forwarded-For"]; ok {
				req.Header.Set("X-Forwarded-For", strings.Join(prior, ", ")+", "+request.RemoteAddr)
			} else {
				req.Header.Set("X-Forwarded-For", request.RemoteAddr)
			}
			if request.TLS != nil {
				req.Header.Set("X-Forwarded-Proto", "https")
			} else {
				req.Header.Set("X-Forwarded-Proto", "http")
			}
		}
		rp.ErrorHandler = func(rw http.ResponseWriter, r *http.Request, err error) {
			http.Error(
				rw,
				fmt.Sprintf("brain %s proxy error: %v", prefix, err),
				http.StatusBadGateway,
			)
		}
		h.byPrefix[prefix] = rp
	}

	// 3) Forward
	h.byPrefix[prefix].ServeHTTP(writer, request)
}
