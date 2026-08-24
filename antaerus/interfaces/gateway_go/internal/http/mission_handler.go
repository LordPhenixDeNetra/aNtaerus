package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"antaerus/interfaces/gateway_go/internal/clients"
)

type MissionHandlers struct {
	missionClient clients.BrainMissionClient
	hub           *Hub
}

func NewMissionHandlers(
	missionClient clients.BrainMissionClient,
	hub *Hub,
) *MissionHandlers {
	return &MissionHandlers{
		missionClient: missionClient,
		hub:           hub,
	}
}

func (h *MissionHandlers) readJSON(r *http.Request, out any) error {
	if r.Body == nil {
		return errors.New("empty body")
	}
	defer r.Body.Close()
	limited := io.LimitReader(r.Body, 1024*1024)
	data, err := io.ReadAll(limited)
	if err != nil {
		return fmt.Errorf("read body: %w", err)
	}
	if len(data) == 0 {
		return errors.New("empty body")
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("decode json: %w", err)
	}
	return nil
}

func splitMissionPath(prefix string, rawPath string) (string, string, bool) {
	trimmed := strings.TrimPrefix(rawPath, prefix)
	trimmed = strings.TrimPrefix(trimmed, "/")
	if trimmed == "" {
		return "", "", true
	}
	parts := strings.SplitN(trimmed, "/", 2)
	missionID := parts[0]
	if missionID == "" || strings.Contains(missionID, "..") {
		return "", "", false
	}
	suffix := ""
	if len(parts) == 2 {
		suffix = parts[1]
	}
	return missionID, suffix, true
}

func (h *MissionHandlers) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	path := request.URL.Path
	basePrefix := "/api/v1/missions"
	if !strings.HasPrefix(path, basePrefix) {
		http.Error(writer, http.StatusText(http.StatusNotFound), http.StatusNotFound)
		return
	}
	missionID, suffix, ok := splitMissionPath(basePrefix, path)
	if !ok {
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}
	if missionID == "" && suffix == "" {
		switch request.Method {
		case http.MethodPost:
			h.handleCreate(writer, request)
		case http.MethodGet:
			h.handleList(writer, request)
		default:
			http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		}
		return
	}
	if missionID != "" && suffix == "" {
		if request.Method == http.MethodGet {
			h.handleGet(writer, request, missionID)
			return
		}
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	if missionID == "" {
		http.Error(writer, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
		return
	}
	switch suffix {
	case "run":
		if request.Method == http.MethodPost {
			h.handleRun(writer, request, missionID)
			return
		}
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	case "recover":
		if request.Method == http.MethodPost {
			h.handleRecover(writer, request, missionID)
			return
		}
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	case "reflect":
		if request.Method == http.MethodPost {
			h.handleReflect(writer, request, missionID)
			return
		}
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	case "events":
		if request.Method == http.MethodGet {
			h.handleEvents(writer, request, missionID)
			return
		}
		http.Error(writer, http.StatusText(http.StatusMethodNotAllowed), http.StatusMethodNotAllowed)
		return
	}
	http.Error(writer, http.StatusText(http.StatusNotFound), http.StatusNotFound)
}

func (h *MissionHandlers) handleCreate(writer http.ResponseWriter, request *http.Request) {
	var req clients.CreateMissionRequest
	if err := h.readJSON(request, &req); err != nil {
		http.Error(writer, err.Error(), http.StatusBadRequest)
		return
	}
	mission, err := h.missionClient.CreateMission(request.Context(), req)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	writeJSON(writer, missionHTTPStatus(mission.Status), mission)
}

func (h *MissionHandlers) handleList(writer http.ResponseWriter, request *http.Request) {
	q := request.URL.Query()
	var sessionID *string
	if v := strings.TrimSpace(q.Get("sessionId")); v != "" {
		sessionID = &v
	}
	var status *string
	if v := strings.TrimSpace(q.Get("status")); v != "" {
		status = &v
	}
	var limit *int
	if v := strings.TrimSpace(q.Get("limit")); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			http.Error(writer, "invalid limit", http.StatusBadRequest)
			return
		}
		if n <= 0 {
			http.Error(writer, "invalid limit", http.StatusBadRequest)
			return
		}
		limit = &n
	}
	resp, err := h.missionClient.ListMissions(request.Context(), sessionID, status, limit)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, resp)
}

func (h *MissionHandlers) handleGet(writer http.ResponseWriter, _ *http.Request, missionID string) {
	mission, err := h.missionClient.GetMission(context.Background(), missionID)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, mission)
}

func (h *MissionHandlers) handleRun(writer http.ResponseWriter, request *http.Request, missionID string) {
	q := request.URL.Query()
	var provider *string
	var model *string
	if v := strings.TrimSpace(q.Get("provider")); v != "" {
		provider = &v
	}
	if v := strings.TrimSpace(q.Get("model")); v != "" {
		model = &v
	}
	mission, err := h.missionClient.RunMission(request.Context(), missionID, provider, model)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	if h.hub != nil {
		h.hub.BroadcastMissionUpdate(mission, nil)
	}
	writeJSON(writer, missionHTTPStatus(mission.Status), mission)
}

func (h *MissionHandlers) handleRecover(writer http.ResponseWriter, request *http.Request, missionID string) {
	mission, err := h.missionClient.RecoverMission(request.Context(), missionID)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	if h.hub != nil {
		h.hub.BroadcastMissionUpdate(mission, nil)
	}
	writeJSON(writer, missionHTTPStatus(mission.Status), mission)
}

func (h *MissionHandlers) handleReflect(writer http.ResponseWriter, request *http.Request, missionID string) {
	q := request.URL.Query()
	var provider *string
	var model *string
	if v := strings.TrimSpace(q.Get("provider")); v != "" {
		provider = &v
	}
	if v := strings.TrimSpace(q.Get("model")); v != "" {
		model = &v
	}
	report, err := h.missionClient.ReflectMission(request.Context(), missionID, provider, model)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, report)
}

func (h *MissionHandlers) handleEvents(writer http.ResponseWriter, request *http.Request, missionID string) {
	_ = request.URL.Query()
	resp, err := h.missionClient.ListMissionEvents(request.Context(), missionID)
	if err != nil {
		writeMissionError(writer, err)
		return
	}
	writeJSON(writer, http.StatusOK, resp)
}

func missionURL(parts ...string) string {
	return "/api/v1/missions/" + strings.Join(parts, "/")
}

var _ = url.PathEscape
