package httpapi

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// TestServeToolsURLRewritingFreshPerCall verifies the Go closure fix:
// each call should recalculate upstreamPath from the CURRENT request, not
// reuse a stale first-request value (bug root cause on 2026-08-26 bug).
func TestServeToolsURLRewritingFreshPerCall(t *testing.T) {
	// -- Upstream test server that echoes the PATH + QUERY we received --
	var received []string
	echo := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got := r.URL.Path
		if r.URL.RawQuery != "" {
			got += "?" + r.URL.RawQuery
		}
		received = append(received, got)
		_, _ = w.Write([]byte("OK:" + got))
	})
	upstream := httptest.NewServer(echo)
	defer upstream.Close()

	handler := NewBrainProxyHandlers(
		upstream.URL,
		5*time.Second,
		map[string]time.Duration{"tools": 5 * time.Second},
	)
	gw := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		handler.ServeTools(w, r)
	}))
	defer gw.Close()

	type trial struct{ inPath, wantUpstream string }
	cases := []trial{
		{inPath: "/api/v1/tools", wantUpstream: "/"},
		{inPath: "/api/v1/tools/summary", wantUpstream: "/summary"},
		{inPath: "/api/v1/tools/filesystem/allowed-roots", wantUpstream: "/filesystem/allowed-roots"},
		{inPath: "/api/v1/tools/execute", wantUpstream: "/execute"},
		// For query: httputil.ReverseProxy forwards RawQuery URL-encoded
		// (correct), so we check RawQuery (path parameter is encoded) matches.
		{inPath: "/api/v1/tools/filesystem/allowed-roots/validate?path=.%2Fdocs", wantUpstream: "/filesystem/allowed-roots/validate?path=.%2Fdocs"},
	}
	for i, c := range cases {
		req, err := http.NewRequest("GET", gw.URL+c.inPath, nil)
		if err != nil {
			t.Fatalf("case %d build req: %v", i, err)
		}
		resp, err := gw.Client().Do(req)
		if err != nil {
			t.Fatalf("case %d do: %v", i, err)
		}
		_ = resp.Body.Close()
		if resp.StatusCode != 200 {
			t.Errorf("case %d status=%d want 200", i, resp.StatusCode)
		}
		got := received[len(received)-1]
		// Normalize: upstream server might double leading slash never, but safe
		if !strings.HasPrefix(got, c.wantUpstream) && got != c.wantUpstream {
			t.Errorf("case %d upstream got %q want prefix %q (input %q)",
				i, got, c.wantUpstream, c.inPath)
		} else {
			t.Logf("case %d PASS gw %q -> upstream %q", i, c.inPath, got)
		}
	}
}
