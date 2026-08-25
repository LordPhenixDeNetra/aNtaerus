package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/contracts"
)

type ProactiveHandlers struct {
	proactiveClient clients.BrainProactiveClient
	hub             *Hub
}

func NewProactiveHandlers(
	proactiveClient clients.BrainProactiveClient,
	hub *Hub,
) *ProactiveHandlers {
	return &ProactiveHandlers{
		proactiveClient: proactiveClient,
		hub:             hub,
	}
}

func writeProactiveError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	var brainErr clients.BrainMissionError
	status := http.StatusBadGateway
	if errors.As(err, &brainErr) {
		status = proactiveHTTPStatus(brainErr.StatusCode, http.StatusBadGateway)
	}
	writeJSON(w, status, map[string]any{
		"error":  err.Error(),
		"detail": err.Error(),
	})
}

func proactiveHTTPStatus(code int, def int) int {
	if code >= 100 && code < 600 {
		return code
	}
	return def
}

func proactiveMissionHTTPStatus(status string) int {
	switch status {
	case "draft":
		return http.StatusCreated
	case "pending", "running", "paused":
		return http.StatusAccepted
	case "completed", "failed", "cancelled", "approved", "rejected":
		return http.StatusOK
	}
	return http.StatusOK
}

func (h *ProactiveHandlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/proactive")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(segments) == 2 && segments[0] == "collectors" && segments[1] == "" && r.Method == http.MethodGet:
		h.handleListCollectors(w, r)
	case len(segments) == 2 && segments[0] == "collectors" && r.Method == http.MethodPost && segments[1] == "run-all":
		h.handleRunAllCollectors(w, r)
	case len(segments) == 3 && segments[0] == "collectors" && r.Method == http.MethodPost && segments[2] == "run":
		h.handleRunCollector(w, r, segments[1])
	case len(segments) == 2 && segments[0] == "initiatives" && segments[1] == "" && r.Method == http.MethodGet:
		h.handleListInitiatives(w, r)
	case len(segments) == 2 && segments[0] == "initiatives" && segments[1] == "" && r.Method == http.MethodPost:
		h.handleCreateInitiative(w, r)
	case len(segments) == 2 && segments[0] == "initiatives" && r.Method == http.MethodGet:
		h.handleGetInitiative(w, r, segments[1])
	case len(segments) == 2 && segments[0] == "initiatives" && r.Method == http.MethodPatch:
		h.handlePatchInitiative(w, r, segments[1])
	case len(segments) == 3 && segments[0] == "initiatives" && r.Method == http.MethodPost && segments[2] == "run":
		h.handleRunInitiative(w, r, segments[1])
	case len(segments) == 3 && segments[0] == "curator" && segments[1] == "report" && r.Method == http.MethodGet:
		h.handleCuratorReport(w, r)
	case len(segments) == 3 && segments[0] == "curator" && segments[1] == "run" && r.Method == http.MethodPost:
		h.handleCuratorRun(w, r)
	case len(segments) == 3 && segments[0] == "curator" && segments[1] == "patches" && r.Method == http.MethodGet:
		h.handleListPatches(w, r)
	case len(segments) == 4 && segments[0] == "curator" && segments[1] == "patches" && segments[3] == "approve" && r.Method == http.MethodPost:
		h.handleDecidePatch(w, r, segments[2], true)
	case len(segments) == 4 && segments[0] == "curator" && segments[1] == "patches" && segments[3] == "reject" && r.Method == http.MethodPost:
		h.handleDecidePatch(w, r, segments[2], false)
	case len(segments) == 3 && segments[0] == "scheduler" && segments[1] == "status" && r.Method == http.MethodGet:
		h.handleSchedulerStatus(w, r)
	case len(segments) == 3 && segments[0] == "scheduler" && segments[1] == "start" && r.Method == http.MethodPost:
		h.handleSchedulerStart(w, r)
	case len(segments) == 3 && segments[0] == "scheduler" && segments[1] == "stop" && r.Method == http.MethodPost:
		h.handleSchedulerStop(w, r)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "proactive route not found"})
	}
}

func (h *ProactiveHandlers) handleListCollectors(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.ListCollectors(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleRunCollector(w http.ResponseWriter, r *http.Request, name string) {
	name, err := url.PathUnescape(name)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid collector name"})
		return
	}
	out, err := h.proactiveClient.RunCollector(r.Context(), name)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, proactiveHTTPStatus(200, http.StatusOK), out)
}

func (h *ProactiveHandlers) handleRunAllCollectors(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.RunAllCollectors(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func queryStringPtr(r *http.Request, key string) *string {
	v := r.URL.Query().Get(key)
	if v == "" {
		return nil
	}
	return &v
}

func queryIntDefault(r *http.Request, key string, def int) int {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	var n int
	if _, err := fmt.Sscanf(v, "%d", &n); err != nil {
		return def
	}
	return n
}

func (h *ProactiveHandlers) handleListInitiatives(w http.ResponseWriter, r *http.Request) {
	status := queryStringPtr(r, "status")
	sessionID := queryStringPtr(r, "sessionId")
	limit := queryIntDefault(r, "limit", 50)
	offset := queryIntDefault(r, "offset", 0)
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	if offset < 0 {
		offset = 0
	}
	out, err := h.proactiveClient.ListInitiatives(r.Context(), status, sessionID, limit, offset)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleCreateInitiative(w http.ResponseWriter, r *http.Request) {
	var req clients.CreateInitiativeRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	out, err := h.proactiveClient.CreateInitiative(r.Context(), req)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (h *ProactiveHandlers) handleGetInitiative(w http.ResponseWriter, r *http.Request, id string) {
	id, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid id"})
		return
	}
	out, err := h.proactiveClient.GetInitiative(r.Context(), id)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handlePatchInitiative(w http.ResponseWriter, r *http.Request, id string) {
	id, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid id"})
		return
	}
	var req clients.PatchInitiativeRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	out, err := h.proactiveClient.PatchInitiative(r.Context(), id, req)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, proactiveMissionHTTPStatus(out.Status), out)
}

func (h *ProactiveHandlers) handleRunInitiative(w http.ResponseWriter, r *http.Request, id string) {
	id, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid id"})
		return
	}
	out, err := h.proactiveClient.RunInitiative(r.Context(), id)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	if h.hub != nil {
		BroadcastInitiativeUpdate(h.hub, out)
	}
	writeJSON(w, proactiveMissionHTTPStatus(out.Status), out)
}

func (h *ProactiveHandlers) handleCuratorReport(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.CuratorLatestReport(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleCuratorRun(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.CuratorRun(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusAccepted, out)
}

func (h *ProactiveHandlers) handleListPatches(w http.ResponseWriter, r *http.Request) {
	reportID := queryStringPtr(r, "reportId")
	status := queryStringPtr(r, "status")
	limit := queryIntDefault(r, "limit", 50)
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}
	out, err := h.proactiveClient.ListPatches(r.Context(), reportID, status, limit)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleDecidePatch(w http.ResponseWriter, r *http.Request, patchID string, approve bool) {
	var req clients.DecidePatchRequest
	if r.Body != nil && r.ContentLength != 0 {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	patchID, err := url.PathUnescape(patchID)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid patch id"})
		return
	}
	out, err := h.proactiveClient.DecidePatch(r.Context(), patchID, approve, req.By)
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleSchedulerStatus(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.SchedulerStatus(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleSchedulerStart(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.SchedulerStart(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *ProactiveHandlers) handleSchedulerStop(w http.ResponseWriter, r *http.Request) {
	out, err := h.proactiveClient.SchedulerStop(r.Context())
	if err != nil {
		writeProactiveError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func BroadcastInitiativeUpdate(hub *Hub, initiative *clients.Initiative) {
	if initiative == nil || hub == nil {
		return
	}
	var autonomyLevel *int
	if initiative.AutonomyLevel != 0 {
		lv := initiative.AutonomyLevel
		autonomyLevel = &lv
	}
	payload := contracts.InitiativeUpdatePayload{
		InitiativeID:     initiative.ID,
		Status:           initiative.Status,
		AutonomyLevel:    autonomyLevel,
		BudgetTokens:     initiative.BudgetTokens,
		BudgetTokensUsed: initiative.BudgetTokensUsed,
		Error:            initiative.Error,
		UpdatedAt:        initiative.UpdatedAt,
	}
	if initiative.RanAt != nil {
		ran := *initiative.RanAt
		payload.RanAt = &ran
	}
	if initiative.CompletedAt != nil {
		c := *initiative.CompletedAt
		payload.CompletedAt = &c
	}
	msg := serverMessage(contracts.ServerMessageInitiativeUpdate, payload)
	select {
	case hub.broadcast <- msg:
	default:
	}
}
