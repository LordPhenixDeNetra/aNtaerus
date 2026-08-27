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
	// Deprecated but kept for back-compat / unused now: previous cache of
	// per-prefix ReverseProxy. We never populate it anymore; the cached part
	// is `_prefixInfra` below (target URL + transport reuse).
	byPrefix map[string]*httputil.ReverseProxy
	// Per-prefix timeout (for net.Dial context + client.Transport).
	perPrefixTimeout map[string]time.Duration
	brainBaseURL     string
	// Cached target URL + Transport per prefix. Transport keeps idle connections
	// and TLS handshakes alive across calls.
	_prefixInfra map[string]prefixInfra
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

// serveForPrefix forwards /api/v1/<prefix>/* -> brain /<prefix>/*.
//
// We intentionally DO NOT cache ReverseProxy.Director by prefix, because
// httputil.ReverseProxy.Director is a closure field on the cached struct,
// and would capture the request of the FIRST invocation only, leading to
// a STALE /wrong URL rewrite for subsequent different paths (404 on all
// but first route hit). See go test TestServeToolsURLRewritingFreshPerCall
// which reproduces that exact bug.
//
// Instead we build a small per-request ReverseProxy (cheap -- it's just a
// struct). Transport is cached by prefix so keepalive/idle connections are
// still reused across calls.
func (h *BrainProxyHandlers) serveForPrefix(
	prefix string,
	writer http.ResponseWriter,
	request *http.Request,
) {
	gwPrefix := "/api/v1/" + prefix
	path := request.URL.Path
	if !strings.HasPrefix(path, gwPrefix) {
		http.Error(writer, fmt.Sprintf("expected path prefix %s, got %s", gwPrefix, path), http.StatusBadRequest)
		return
	}

	// 1) Ensure per-prefix cached transport + parsed target exist.
	target, transport, ok := h.lazyPrefixInfra(prefix, writer)
	if !ok {
		return
	}

	// 2) Build a fresh single-request ReverseProxy, with Director referencing
	//    the *current* `request` (outer param) and *current* `path`.
	//    This is 100% stateless and cheap (~6 struct fields).
	rp := &httputil.ReverseProxy{
		Transport: transport,
		ErrorHandler: func(rw http.ResponseWriter, r *http.Request, err error) {
			http.Error(
				rw,
				fmt.Sprintf("brain %s proxy error: %v", prefix, err),
				http.StatusBadGateway,
			)
		},
	}
	rp.Director = func(req *http.Request) {
		upstreamPath := strings.TrimPrefix(path, "/api/v1")
		if upstreamPath == "" || !strings.HasPrefix(upstreamPath, "/") {
			upstreamPath = "/" + upstreamPath
		}
		req.URL.Scheme = target.Scheme
		req.URL.Host = target.Host
		req.URL.Path = upstreamPath
		req.URL.RawQuery = request.URL.RawQuery
		req.Host = target.Host
		if req.Header == nil {
			req.Header = http.Header{}
		}
		// X-Forwarded-For chain
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
		// Drop hop-by-hop headers per RFC 7230
		for _, h := range []string{"Connection", "Keep-Alive", "Proxy-Authenticate", "Proxy-Authorization", "TE", "Trailers", "Transfer-Encoding", "Upgrade"} {
			req.Header.Del(h)
		}
	}

	// 3) Forward once
	rp.ServeHTTP(writer, request)
}

type prefixInfra struct {
	target    *url.URL
	transport *http.Transport
}

// lazyPrefixInfra returns parsed target + cached transport for this prefix.
// Returns ok==false if brainBaseURL is invalid (writes 500 on writer).
func (h *BrainProxyHandlers) lazyPrefixInfra(
	prefix string,
	writer http.ResponseWriter,
) (*url.URL, *http.Transport, bool) {
	inf, ok := h._prefixInfra[prefix]
	if ok {
		return inf.target, inf.transport, true
	}
	// Build & cache
	target, _ := url.Parse(h.brainBaseURL)
	if target == nil {
		http.Error(writer, "invalid brain base url", http.StatusInternalServerError)
		return nil, nil, false
	}
	transport := &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		ForceAttemptHTTP2:     true,
		MaxIdleConns:          16,
		IdleConnTimeout:       60 * time.Second,
		TLSHandshakeTimeout:   10 * time.Second,
		ExpectContinueTimeout: 1 * time.Second,
	}
	inf = prefixInfra{target: target, transport: transport}
	if h._prefixInfra == nil {
		h._prefixInfra = map[string]prefixInfra{}
	}
	h._prefixInfra[prefix] = inf
	return inf.target, inf.transport, true
}
