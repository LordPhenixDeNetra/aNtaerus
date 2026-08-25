package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
)

type fakeSkillsBrain struct {
	t *testing.T
}

func (f *fakeSkillsBrain) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	switch {
	case r.Method == http.MethodGet && r.URL.Path == "/skills":
		_ = json.NewEncoder(w).Encode(clients.SkillListResponse{
			Items: []clients.SkillRecord{
				{ID: "s-1", Name: "a", Runtime: "python", Status: "installed", CreatedAt: "x", UpdatedAt: "x", Checksum: "c1"},
				{ID: "s-2", Name: "b", Runtime: "wasm", Status: "pending_approval", CreatedAt: "x", UpdatedAt: "x", Checksum: "c2"},
			},
			Total: 2,
		})
	case r.Method == http.MethodPost && r.URL.Path == "/skills":
		var body clients.SkillInstallRequest
		_ = json.NewDecoder(r.Body).Decode(&body)
		_ = json.NewEncoder(w).Encode(clients.SkillRecord{
			ID: "s-new", Name: body.Name, Runtime: body.Runtime, Status: "installed",
			Version: body.Version, Description: body.Description, Category: body.Category,
			SourceCode: body.SourceCode, CreatedAt: "now", UpdatedAt: "now", Checksum: "cx",
		})
	case r.URL.Path == "/skills/s-1":
		switch r.Method {
		case http.MethodGet:
			_ = json.NewEncoder(w).Encode(clients.SkillRecord{ID: "s-1", Name: "a", Status: "installed", Runtime: "python", CreatedAt: "x", UpdatedAt: "x", Checksum: "c1"})
		case http.MethodPut:
			_ = json.NewEncoder(w).Encode(clients.SkillRecord{ID: "s-1", Name: "a", Status: "installed", Description: "updated", CreatedAt: "x", UpdatedAt: "y", Checksum: "c1"})
		case http.MethodDelete:
			w.WriteHeader(http.StatusNoContent)
		}
	case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/run"):
		id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/skills/"), "/run")
		_ = json.NewEncoder(w).Encode(clients.SkillRunResult{
			ExitCode:    0,
			Stdout:      `{"ran":"` + id + `"}`,
			FuelUsed:    intPtr(10),
			DurationMs:  5,
			SandboxKind: "docker",
		})
	case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/approve"):
		_ = json.NewEncoder(w).Encode(clients.SkillRecord{ID: "s-2", Name: "b", Status: "installed"})
	case r.Method == http.MethodPost && strings.HasSuffix(r.URL.Path, "/reject"):
		var body clients.SkillApprovalDecision
		_ = json.NewDecoder(r.Body).Decode(&body)
		if len(body.Reason) < 8 {
			http.Error(w, `{"detail":"reason too short min 8"}`, http.StatusBadRequest)
			return
		}
		_ = json.NewEncoder(w).Encode(clients.SkillRecord{ID: "s-2", Name: "b", Status: "rejected"})
	default:
		http.Error(w, `{"detail":"nf"}`, http.StatusNotFound)
	}
}

func newTestSkillsHub() (*SkillsHandlers, *httptest.Server) {
	brain := httptest.NewServer(&fakeSkillsBrain{})
	client := clients.NewBrainSkillsClient(brain.Client(), brain.URL, time.Second)
	return NewSkillsHandlers(client), brain
}

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func TestSkillsHandler_List(t *testing.T) {
	h, brain := newTestSkillsHub()
	defer brain.Close()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/skills?limit=5", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list %d: %s", rr.Code, rr.Body.String())
	}
	var list clients.SkillListResponse
	if err := json.NewDecoder(rr.Body).Decode(&list); err != nil {
		t.Fatalf("decode list %v", err)
	}
	if list.Total != 2 {
		t.Fatalf("total %d", list.Total)
	}
}

func TestSkillsHandler_InstallAndRun(t *testing.T) {
	h, brain := newTestSkillsHub()
	defer brain.Close()

	installBody := bytes.NewBufferString(`{"name":"n","version":"0.1.0","runtime":"python","sourceCode":"x"}`)
	req := httptest.NewRequest(http.MethodPost, "/api/v1/skills", installBody)
	req.Header.Set("Content-Type", "application/json")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code >= 300 {
		t.Fatalf("install %d: %s", rr.Code, rr.Body.String())
	}
	var created clients.SkillRecord
	_ = json.NewDecoder(rr.Body).Decode(&created)
	if created.ID != "s-new" {
		t.Fatalf("created id %q", created.ID)
	}

	runReq := httptest.NewRequest(http.MethodPost, "/api/v1/skills/s-1/run", bytes.NewBufferString(`{"argsJson":"{}"}`))
	runReq.Header.Set("Content-Type", "application/json")
	runRR := httptest.NewRecorder()
	h.ServeHTTP(runRR, runReq)
	if runRR.Code != http.StatusOK {
		t.Fatalf("run %d: %s", runRR.Code, runRR.Body.String())
	}
	var res clients.SkillRunResult
	_ = json.NewDecoder(runRR.Body).Decode(&res)
	if res.ExitCode != 0 || res.SandboxKind != "docker" {
		t.Fatalf("run result %+v", res)
	}
	if res.FuelUsed == nil || *res.FuelUsed != 10 {
		t.Fatalf("fuel mismatch %+v", res.FuelUsed)
	}
}

func TestSkillsHandler_RejectRequiresReason(t *testing.T) {
	h, brain := newTestSkillsHub()
	defer brain.Close()

	bad := httptest.NewRequest(http.MethodPost, "/api/v1/skills/s-2/reject", bytes.NewBufferString(`{"reason":"short"}`))
	bad.Header.Set("Content-Type", "application/json")
	badRR := httptest.NewRecorder()
	h.ServeHTTP(badRR, bad)
	if badRR.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d: %s", badRR.Code, badRR.Body.String())
	}

	good := httptest.NewRequest(http.MethodPost, "/api/v1/skills/s-2/reject", bytes.NewBufferString(`{"reason":"motif long minimum huit"}`))
	good.Header.Set("Content-Type", "application/json")
	goodRR := httptest.NewRecorder()
	h.ServeHTTP(goodRR, good)
	if goodRR.Code != http.StatusOK {
		t.Fatalf("reject success code %d: %s", goodRR.Code, goodRR.Body.String())
	}
	var rec clients.SkillRecord
	_ = json.NewDecoder(goodRR.Body).Decode(&rec)
	if rec.Status != "rejected" {
		t.Fatalf("status %q", rec.Status)
	}
}

func TestSkillsHandler_GetAndPutAndDelete(t *testing.T) {
	h, brain := newTestSkillsHub()
	defer brain.Close()

	getReq := httptest.NewRequest(http.MethodGet, "/api/v1/skills/s-1", nil)
	getRR := httptest.NewRecorder()
	h.ServeHTTP(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("get %d", getRR.Code)
	}

	putReq := httptest.NewRequest(http.MethodPut, "/api/v1/skills/s-1", bytes.NewBufferString(`{"description":"updated"}`))
	putReq.Header.Set("Content-Type", "application/json")
	putRR := httptest.NewRecorder()
	h.ServeHTTP(putRR, putReq)
	if putRR.Code != http.StatusOK {
		t.Fatalf("put %d %s", putRR.Code, putRR.Body.String())
	}

	delReq := httptest.NewRequest(http.MethodDelete, "/api/v1/skills/s-1", nil)
	delRR := httptest.NewRecorder()
	h.ServeHTTP(delRR, delReq)
	if delRR.Code != http.StatusNoContent {
		t.Fatalf("del %d", delRR.Code)
	}
}
