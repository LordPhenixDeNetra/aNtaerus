package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"antaerus/interfaces/gateway_go/internal/clients"
)

type SkillsHandlers struct {
	skillsClient clients.BrainSkillsClient
}

func NewSkillsHandlers(skillsClient clients.BrainSkillsClient) *SkillsHandlers {
	return &SkillsHandlers{skillsClient: skillsClient}
}

func writeSkillsError(w http.ResponseWriter, err error) {
	if err == nil {
		return
	}
	var brainErr clients.BrainMissionError
	status := http.StatusBadGateway
	if errors.As(err, &brainErr) {
		if brainErr.StatusCode >= 100 && brainErr.StatusCode < 600 {
			status = brainErr.StatusCode
		}
	}
	writeJSON(w, status, map[string]any{
		"error":  err.Error(),
		"detail": err.Error(),
	})
}

func (h *SkillsHandlers) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/v1/skills")
	if path == "" {
		path = "/"
	}
	segments := strings.Split(strings.Trim(path, "/"), "/")

	switch {
	case len(segments) == 1 && segments[0] == "" && r.Method == http.MethodGet:
		h.handleListSkills(w, r)
	case len(segments) == 1 && segments[0] == "" && r.Method == http.MethodPost:
		h.handleInstallSkill(w, r)
	case len(segments) == 1 && r.Method == http.MethodGet:
		h.handleGetSkill(w, r, segments[0])
	case len(segments) == 1 && r.Method == http.MethodPut:
		h.handleUpdateSkill(w, r, segments[0])
	case len(segments) == 1 && r.Method == http.MethodDelete:
		h.handleUninstallSkill(w, r, segments[0])
	case len(segments) == 2 && segments[1] == "run" && r.Method == http.MethodPost:
		h.handleRunSkill(w, r, segments[0])
	case len(segments) == 2 && segments[1] == "approve" && r.Method == http.MethodPost:
		h.handleApproveSkill(w, r, segments[0], true)
	case len(segments) == 2 && segments[1] == "reject" && r.Method == http.MethodPost:
		h.handleApproveSkill(w, r, segments[0], false)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "skills route not found"})
	}
}

func (h *SkillsHandlers) handleListSkills(w http.ResponseWriter, r *http.Request) {
	category := queryStringPtr(r, "category")
	runtime := queryStringPtr(r, "runtime")
	status := queryStringPtr(r, "status")
	search := queryStringPtr(r, "search")
	limit := queryIntDefault(r, "limit", 100)
	offset := queryIntDefault(r, "offset", 0)
	if limit <= 0 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	if offset < 0 {
		offset = 0
	}
	out, err := h.skillsClient.ListSkills(r.Context(), category, runtime, status, search, limit, offset)
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SkillsHandlers) handleGetSkill(w http.ResponseWriter, r *http.Request, id string) {
	unescaped, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid skill id"})
		return
	}
	out, err := h.skillsClient.GetSkill(r.Context(), unescaped)
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SkillsHandlers) handleInstallSkill(w http.ResponseWriter, r *http.Request) {
	var req clients.SkillInstallRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "champ name requis"})
		return
	}
	if req.Runtime == "" {
		req.Runtime = "python"
	}
	if req.Version == "" {
		req.Version = "0.1.0"
	}
	out, err := h.skillsClient.InstallSkill(r.Context(), req)
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, out)
}

func (h *SkillsHandlers) handleUpdateSkill(w http.ResponseWriter, r *http.Request, id string) {
	unescaped, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid skill id"})
		return
	}
	var req clients.SkillUpdateRequest
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	out, err := h.skillsClient.UpdateSkill(r.Context(), unescaped, req)
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *SkillsHandlers) handleUninstallSkill(w http.ResponseWriter, r *http.Request, id string) {
	unescaped, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid skill id"})
		return
	}
	if err := h.skillsClient.UninstallSkill(r.Context(), unescaped); err != nil {
		writeSkillsError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *SkillsHandlers) handleRunSkill(w http.ResponseWriter, r *http.Request, id string) {
	unescaped, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid skill id"})
		return
	}
	var req clients.SkillRunRequest
	req.TimeoutMs = 30000
	req.FuelLimit = 250000
	req.ArgsJSON = "{}"
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	out, err := h.skillsClient.RunSkill(r.Context(), unescaped, req)
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

type decideBody struct {
	By     *string `json:"by,omitempty"`
	Reason string  `json:"reason"`
}

func (h *SkillsHandlers) handleApproveSkill(
	w http.ResponseWriter,
	r *http.Request,
	id string,
	approve bool,
) {
	unescaped, err := url.PathUnescape(id)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid skill id"})
		return
	}
	var body decideBody
	if r.Body != nil && r.ContentLength != 0 {
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]any{"error": fmt.Sprintf("invalid json: %v", err)})
			return
		}
	}
	var out *clients.SkillRecord
	if approve {
		out, err = h.skillsClient.ApproveSkill(r.Context(), unescaped, body.By, body.Reason)
	} else {
		if len(strings.TrimSpace(body.Reason)) < 8 {
			writeJSON(w, http.StatusBadRequest, map[string]any{
				"error": "motif rejet requiert au moins 8 caracteres",
			})
			return
		}
		out, err = h.skillsClient.RejectSkill(r.Context(), unescaped, body.By, body.Reason)
	}
	if err != nil {
		writeSkillsError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}
