package clients

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestBrainMissionClientCreateMission(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		if request.Method != http.MethodPost {
			t.Fatalf("unexpected method %s", request.Method)
		}
		if request.URL.Path != "/missions" {
			t.Fatalf("unexpected path %s", request.URL.Path)
		}
		var body CreateMissionRequest
		if err := json.NewDecoder(request.Body).Decode(&body); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		if body.UserRequest != "trouver mail" {
			t.Fatalf("unexpected user_request %q", body.UserRequest)
		}
		writer.Header().Set("Content-Type", "application/json")
		writer.WriteHeader(http.StatusCreated)
		_ = json.NewEncoder(writer).Encode(Mission{
			ID:          "m1",
			Title:       "M1",
			UserRequest: "trouver mail",
			Status:      "planned",
			CreatedAt:   "2026-08-24T00:00:00Z",
			UpdatedAt:   "2026-08-24T00:00:00Z",
		})
	}))
	defer server.Close()
	client := NewBrainMissionClient(server.Client(), server.URL, time.Second)
	mission, err := client.CreateMission(context.Background(), CreateMissionRequest{
		UserRequest: "trouver mail",
	})
	if err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if mission.ID != "m1" {
		t.Fatalf("unexpected mission id %q", mission.ID)
	}
	if mission.Status != "planned" {
		t.Fatalf("unexpected status %q", mission.Status)
	}
}

func TestBrainMissionClientListAndRunAndRecover(t *testing.T) {
	var methodLog []string
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		methodLog = append(methodLog, request.Method+" "+request.URL.Path+"?"+request.URL.RawQuery)
		writer.Header().Set("Content-Type", "application/json")
		path := request.URL.Path
		switch {
		case path == "/missions" && request.Method == http.MethodGet:
			_ = json.NewEncoder(writer).Encode(ListMissionsResponse{
				Items: []Mission{
					{ID: "m1", Status: "planned", Title: "M", UserRequest: "u", CreatedAt: "x", UpdatedAt: "x"},
				},
				Total: 1,
			})
		case strings.HasPrefix(path, "/missions/") && strings.HasSuffix(path, "/run"):
			missionID := strings.TrimPrefix(strings.TrimSuffix(path, "/run"), "/missions/")
			_ = json.NewEncoder(writer).Encode(Mission{
				ID: missionID, Status: "running", Title: "M", UserRequest: "u",
				Steps: []MissionStep{
					{ID: "s0", Index: 0, Title: "S0", Status: "running"},
				},
				CreatedAt: "x", UpdatedAt: "x",
			})
		case strings.HasPrefix(path, "/missions/") && strings.HasSuffix(path, "/recover"):
			missionID := strings.TrimPrefix(strings.TrimSuffix(path, "/recover"), "/missions/")
			_ = json.NewEncoder(writer).Encode(Mission{
				ID: missionID, Status: "running", Title: "M", UserRequest: "u", CreatedAt: "x", UpdatedAt: "x",
			})
		case strings.HasPrefix(path, "/missions/") && strings.HasSuffix(path, "/reflect"):
			missionID := strings.TrimPrefix(strings.TrimSuffix(path, "/reflect"), "/missions/")
			_ = json.NewEncoder(writer).Encode(ReflexionReport{
				MissionID: missionID, Summary: "resume", ScoreQuality: 0.8,
				GeneratedAt: "x",
			})
		case strings.HasPrefix(path, "/missions/") && strings.HasSuffix(path, "/events"):
			missionID := strings.TrimPrefix(strings.TrimSuffix(path, "/events"), "/missions/")
			_ = missionID
			_ = json.NewEncoder(writer).Encode(MissionEventsResponse{Items: []MissionEvent{
				{ID: "e1", MissionID: missionID, Kind: "step_started", Payload: map[string]interface{}{}, CreatedAt: "x"},
			}})
		default:
			t.Fatalf("unexpected request %s %s", request.Method, path)
		}
	}))
	defer server.Close()
	client := NewBrainMissionClient(server.Client(), server.URL, time.Second)
	listResp, err := client.ListMissions(context.Background(), nil, nil, nil)
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if listResp.Total != 1 {
		t.Fatalf("expected total 1, got %d", listResp.Total)
	}
	run, err := client.RunMission(context.Background(), "m-abc", nil, nil)
	if err != nil {
		t.Fatalf("run: %v", err)
	}
	if run.Status != "running" || len(run.Steps) != 1 {
		t.Fatalf("unexpected run result %+v", run)
	}
	rec, err := client.RecoverMission(context.Background(), "m-abc")
	if err != nil {
		t.Fatalf("recover: %v", err)
	}
	if rec.Status != "running" {
		t.Fatalf("unexpected recover status %q", rec.Status)
	}
	ref, err := client.ReflectMission(context.Background(), "m-abc", nil, nil)
	if err != nil {
		t.Fatalf("reflect: %v", err)
	}
	if ref.ScoreQuality != 0.8 {
		t.Fatalf("reflect score %f", ref.ScoreQuality)
	}
	evs, err := client.ListMissionEvents(context.Background(), "m-abc")
	if err != nil {
		t.Fatalf("events: %v", err)
	}
	if len(evs.Items) != 1 {
		t.Fatalf("events count %d", len(evs.Items))
	}
}

func TestBrainMissionClientMaps409ToError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		http.Error(writer, `{"detail":"conflict"}`, http.StatusConflict)
	}))
	defer server.Close()
	client := NewBrainMissionClient(server.Client(), server.URL, time.Second)
	_, err := client.RunMission(context.Background(), "m-finished", nil, nil)
	if err == nil {
		t.Fatalf("expected error")
	}
	var missionErr BrainMissionError
	if !errors.As(err, &missionErr) {
		t.Fatalf("expected BrainMissionError, got %T %v", err, err)
	}
	if missionErr.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409, got %d", missionErr.StatusCode)
	}
}
