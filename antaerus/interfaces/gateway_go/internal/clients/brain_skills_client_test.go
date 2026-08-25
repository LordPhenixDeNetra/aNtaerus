package clients

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func strPtr(s string) *string { return &s }
func intPtr(i int) *int       { return &i }

func TestBrainSkillsClientListSkills(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/skills" || r.Method != http.MethodGet {
			t.Fatalf("unexpected req %s %s", r.Method, r.URL.Path)
		}
		w.Header().Set("Content-Type", "application/json")
		resp := SkillListResponse{
			Items: []SkillRecord{{
				ID:          "s-1",
				Name:        "echo",
				Version:     "0.1.0",
				Description: "echo",
				Runtime:     "python",
				Category:    "general",
				Status:      "installed",
				Checksum:    "sha256:x",
				CreatedAt:   "now",
				UpdatedAt:   "now",
			}},
			Total: 1,
		}
		_ = json.NewEncoder(w).Encode(resp)
	}))
	defer server.Close()

	client := NewBrainSkillsClient(server.Client(), server.URL, time.Second)
	list, err := client.ListSkills(context.Background(), nil, nil, nil, nil, 10, 0)
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if list.Total != 1 {
		t.Fatalf("total %d", list.Total)
	}
	if len(list.Items) != 1 || list.Items[0].Name != "echo" {
		t.Fatalf("unexpected items %+v", list.Items)
	}
}

func TestBrainSkillsClientInstallAndRun(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/skills":
			var body SkillInstallRequest
			_ = json.NewDecoder(r.Body).Decode(&body)
			_ = json.NewEncoder(w).Encode(SkillRecord{
				ID:          "s-new",
				Name:        body.Name,
				Version:     body.Version,
				Description: body.Description,
				Runtime:     body.Runtime,
				Category:    body.Category,
				Author:      body.Author,
				SourceCode:  body.SourceCode,
				Status:      "pending_approval",
				Checksum:    "sha256:a",
				CreatedAt:   "now",
				UpdatedAt:   "now",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/skills/s-new/run":
			var body SkillRunRequest
			_ = json.NewDecoder(r.Body).Decode(&body)
			_ = json.NewEncoder(w).Encode(SkillRunResult{
				ExitCode:    0,
				Stdout:      `{"ok":true,"args":` + body.ArgsJSON + `}`,
				Stderr:      "",
				FuelUsed:    intPtr(42),
				DurationMs:  12,
				SandboxKind: "docker",
			})
		case r.Method == http.MethodPost && r.URL.Path == "/skills/s-new/approve":
			_ = json.NewEncoder(w).Encode(SkillRecord{
				ID:     "s-new",
				Name:   "installed-skill",
				Status: "installed",
			})
		default:
			http.Error(w, `{"detail":"nf"}`, http.StatusNotFound)
		}
	}))
	defer server.Close()

	client := NewBrainSkillsClient(server.Client(), server.URL, time.Second)
	installed, err := client.InstallSkill(context.Background(), SkillInstallRequest{
		Name:        "demo",
		Version:     "0.1.0",
		Description: "d",
		Runtime:     "python",
		Category:    "general",
		Author:      "tester",
		SourceCode:  "def main(args): return args\n",
		Trusted:     false,
	})
	if err != nil {
		t.Fatalf("install failed: %v", err)
	}
	if installed.Status != "pending_approval" {
		t.Fatalf("expected pending approval, got %q", installed.Status)
	}

	result, err := client.RunSkill(context.Background(), "s-new", SkillRunRequest{
		ArgsJSON:  `{"a":1}`,
		TimeoutMs: 30000,
		FuelLimit: 250000,
	})
	if err != nil {
		t.Fatalf("run failed: %v", err)
	}
	if result.ExitCode != 0 || result.SandboxKind != "docker" {
		t.Fatalf("unexpected result %+v", result)
	}
	if result.FuelUsed == nil || *result.FuelUsed != 42 {
		t.Fatalf("fuel mismatch %+v", result.FuelUsed)
	}

	approved, err := client.ApproveSkill(context.Background(), "s-new", nil, "tester")
	if err != nil {
		t.Fatalf("approve failed: %v", err)
	}
	if approved.Status != "installed" {
		t.Fatalf("status after approve %q", approved.Status)
	}
}

func boolPtr(b bool) *bool { return &b }

func TestBrainSkillsClientRejectSkillRequiresReason(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost && r.URL.Path == "/skills/bad/reject" {
			var body SkillApprovalDecision
			_ = json.NewDecoder(r.Body).Decode(&body)
			if len(body.Reason) < 8 {
				http.Error(w, `{"detail":"reason too short"}`, http.StatusBadRequest)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(SkillRecord{ID: "bad", Status: "rejected"})
			return
		}
		http.Error(w, `{"detail":"nf"}`, http.StatusNotFound)
	}))
	defer server.Close()
	client := NewBrainSkillsClient(server.Client(), server.URL, time.Second)
	_, err := client.RejectSkill(context.Background(), "bad", nil, "short")
	if err == nil {
		t.Fatalf("expected reject with short reason to fail")
	}
	rejected, err := client.RejectSkill(context.Background(), "bad", nil, "long enough reason here")
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if rejected.Status != "rejected" {
		t.Fatalf("rejected status %q", rejected.Status)
	}
}
