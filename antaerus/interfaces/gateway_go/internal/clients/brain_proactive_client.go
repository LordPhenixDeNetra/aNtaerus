package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type CollectorInfo struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Enabled     bool   `json:"enabled"`
}

type ListCollectorsResponse struct {
	Items []CollectorInfo `json:"items"`
}

type CollectorBriefing struct {
	Title      string                 `json:"title"`
	Summary    string                 `json:"summary"`
	GeneratedAt string                `json:"generatedAt"`
	Metadata   map[string]interface{} `json:"metadata,omitempty"`
}

type CollectorAlert struct {
	Title       string `json:"title"`
	Message     string `json:"message"`
	Severity    string `json:"severity"`
	Source      string `json:"source,omitempty"`
	GeneratedAt string `json:"generatedAt"`
}

type RunCollectorResponse struct {
	CollectorName string            `json:"collectorName"`
	Success       bool              `json:"success"`
	Briefing      *CollectorBriefing `json:"briefing,omitempty"`
	Alerts        []CollectorAlert  `json:"alerts"`
	Error         *string           `json:"error,omitempty"`
	RanAt         string            `json:"ranAt"`
}

type RunAllCollectorsResponse struct {
	Items []RunCollectorResponse `json:"items"`
}

type Initiative struct {
	ID              string                 `json:"id"`
	Title           string                 `json:"title"`
	Description     *string                `json:"description,omitempty"`
	Status          string                 `json:"status"`
	AutonomyLevel   int                    `json:"autonomyLevel"`
	BudgetTokens    int                    `json:"budgetTokens"`
	BudgetTokensUsed int                   `json:"budgetTokensUsed"`
	TriggerType     string                 `json:"triggerType"`
	TriggerConfig   map[string]interface{} `json:"triggerConfig,omitempty"`
	SourceCollector *string                `json:"sourceCollector,omitempty"`
	AlertPayload    map[string]interface{} `json:"alertPayload,omitempty"`
	SessionID       *string                `json:"sessionId,omitempty"`
	MissionID       *string                `json:"missionId,omitempty"`
	Error           *string                `json:"error,omitempty"`
	CreatedAt       string                 `json:"createdAt"`
	UpdatedAt       string                 `json:"updatedAt"`
	RanAt           *string                `json:"ranAt,omitempty"`
	CompletedAt     *string                `json:"completedAt,omitempty"`
}

type CreateInitiativeRequest struct {
	Title           string                 `json:"title"`
	Description     *string                `json:"description,omitempty"`
	Status          *string                `json:"status,omitempty"`
	AutonomyLevel   *int                   `json:"autonomyLevel,omitempty"`
	BudgetTokens    *int                   `json:"budgetTokens,omitempty"`
	TriggerType     *string                `json:"triggerType,omitempty"`
	TriggerConfig   map[string]interface{} `json:"triggerConfig,omitempty"`
	SourceCollector *string                `json:"sourceCollector,omitempty"`
	AlertPayload    map[string]interface{} `json:"alertPayload,omitempty"`
	SessionID       *string                `json:"sessionId,omitempty"`
}

type PatchInitiativeRequest struct {
	Title           *string                `json:"title,omitempty"`
	Description     *string                `json:"description,omitempty"`
	Status          *string                `json:"status,omitempty"`
	AutonomyLevel   *int                   `json:"autonomyLevel,omitempty"`
	BudgetTokens    *int                   `json:"budgetTokens,omitempty"`
	BudgetTokensUsed *int                   `json:"budgetTokensUsed,omitempty"`
	TriggerType     *string                `json:"triggerType,omitempty"`
	TriggerConfig   map[string]interface{} `json:"triggerConfig,omitempty"`
	SourceCollector *string                `json:"sourceCollector,omitempty"`
	AlertPayload    map[string]interface{} `json:"alertPayload,omitempty"`
	SessionID       *string                `json:"sessionId,omitempty"`
	MissionID       *string                `json:"missionId,omitempty"`
	Error           *string                `json:"error,omitempty"`
	RanAt           *string                `json:"ranAt,omitempty"`
	CompletedAt     *string                `json:"completedAt,omitempty"`
}

type ListInitiativesResponse struct {
	Items []Initiative `json:"items"`
	Total int          `json:"total"`
}

type CuratorPatch struct {
	ID             string                 `json:"id"`
	ReportID       string                 `json:"reportId"`
	Kind           string                 `json:"kind"`
	Title          string                 `json:"title"`
	Description    *string                `json:"description,omitempty"`
	ProposedDiff   map[string]interface{} `json:"proposedDiff,omitempty"`
	TargetTable    *string                `json:"targetTable,omitempty"`
	TargetID       *string                `json:"targetId,omitempty"`
	RequiresHuman  bool                   `json:"requiresHuman"`
	AutonomyLevel  int                    `json:"autonomyLevel"`
	Status         string                 `json:"status"`
	AppliedAt      *string                `json:"appliedAt,omitempty"`
	DecidedAt      *string                `json:"decidedAt,omitempty"`
	DecidedBy      *string                `json:"decidedBy,omitempty"`
	CreatedAt      string                 `json:"createdAt"`
}

type CuratorReport struct {
	ID                 string         `json:"id"`
	GeneratedAt        string         `json:"generatedAt"`
	DurationMs         int            `json:"durationMs"`
	FactsAdded         int            `json:"factsAdded"`
	FactsContradictory int            `json:"factsContradictory"`
	UnusedSkills       []string       `json:"unusedSkills"`
	UnusedTools        []string       `json:"unusedTools"`
	EstimatedSpendTokens int          `json:"estimatedSpendTokens"`
	EstimatedCostUsd   float64        `json:"estimatedCostUsd"`
	TopPatchesCount    int            `json:"topPatchesCount"`
	Notes              []string       `json:"notes"`
	Patches            []CuratorPatch `json:"patches"`
}

type ListPatchesResponse struct {
	Items []CuratorPatch `json:"items"`
	Total int            `json:"total"`
}

type DecidePatchRequest struct {
	Approve bool    `json:"approve"`
	By      *string `json:"by,omitempty"`
}

type SchedulerStatusResponse struct {
	Enabled  bool    `json:"enabled"`
	CronHour int     `json:"cronHour"`
	LastRun  *string `json:"lastRun,omitempty"`
	NextRun  *string `json:"nextRun,omitempty"`
}

type BrainProactiveClient struct {
	httpClient     httpClient
	baseURL        string
	requestTimeout time.Duration
}

func NewBrainProactiveClient(
	httpClient *http.Client,
	baseURL string,
	requestTimeout time.Duration,
) BrainProactiveClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: requestTimeout}
	}
	return BrainProactiveClient{
		httpClient:     client,
		baseURL:        strings.TrimRight(baseURL, "/"),
		requestTimeout: requestTimeout,
	}
}

func (c BrainProactiveClient) doJSON(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	body any,
	out any,
) error {
	var reqBody io.Reader
	if body != nil {
		buf, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal proactive request: %w", err)
		}
		reqBody = bytes.NewReader(buf)
	}
	rawURL := c.baseURL + path
	if query != nil {
		if q := query.Encode(); q != "" {
			sep := "?"
			if strings.Contains(rawURL, "?") {
				sep = "&"
			}
			rawURL += sep + q
		}
	}
	ctx, cancel := context.WithTimeout(ctx, c.requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, method, rawURL, reqBody)
	if err != nil {
		return fmt.Errorf("build proactive request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("proactive request: %w", err)
	}
	defer func() { _, _ = io.Copy(io.Discard, resp.Body); _ = resp.Body.Close() }()
	rawBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read proactive response: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return BrainMissionError{
			StatusCode: resp.StatusCode,
			Body:       string(rawBytes),
		}
	}
	if out != nil && len(rawBytes) > 0 {
		if err := json.Unmarshal(rawBytes, out); err != nil {
			return fmt.Errorf("decode proactive response: %w", err)
		}
	}
	return nil
}

func (c BrainProactiveClient) ListCollectors(ctx context.Context) (*ListCollectorsResponse, error) {
	var out ListCollectorsResponse
	if err := c.doJSON(ctx, http.MethodGet, "/proactive/collectors", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) RunCollector(ctx context.Context, name string) (*RunCollectorResponse, error) {
	var out RunCollectorResponse
	path := "/proactive/collectors/" + url.PathEscape(name) + "/run"
	if err := c.doJSON(ctx, http.MethodPost, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) RunAllCollectors(ctx context.Context) (*RunAllCollectorsResponse, error) {
	var out RunAllCollectorsResponse
	if err := c.doJSON(ctx, http.MethodPost, "/proactive/collectors/run-all", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) ListInitiatives(
	ctx context.Context,
	status *string,
	sessionID *string,
	limit int,
	offset int,
) (*ListInitiativesResponse, error) {
	q := url.Values{}
	if status != nil {
		q.Set("status", *status)
	}
	if sessionID != nil {
		q.Set("sessionId", *sessionID)
	}
	q.Set("limit", strconv.Itoa(limit))
	q.Set("offset", strconv.Itoa(offset))
	var out ListInitiativesResponse
	if err := c.doJSON(ctx, http.MethodGet, "/proactive/initiatives", q, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) CreateInitiative(
	ctx context.Context,
	req CreateInitiativeRequest,
) (*Initiative, error) {
	var out Initiative
	if err := c.doJSON(ctx, http.MethodPost, "/proactive/initiatives", nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) GetInitiative(ctx context.Context, id string) (*Initiative, error) {
	var out Initiative
	path := "/proactive/initiatives/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodGet, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) PatchInitiative(
	ctx context.Context,
	id string,
	req PatchInitiativeRequest,
) (*Initiative, error) {
	var out Initiative
	path := "/proactive/initiatives/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodPatch, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) RunInitiative(ctx context.Context, id string) (*Initiative, error) {
	var out Initiative
	path := "/proactive/initiatives/" + url.PathEscape(id) + "/run"
	if err := c.doJSON(ctx, http.MethodPost, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) CuratorLatestReport(ctx context.Context) (*CuratorReport, error) {
	var out CuratorReport
	if err := c.doJSON(ctx, http.MethodGet, "/proactive/curator/report", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) CuratorRun(ctx context.Context) (*CuratorReport, error) {
	var out CuratorReport
	if err := c.doJSON(ctx, http.MethodPost, "/proactive/curator/run", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) ListPatches(
	ctx context.Context,
	reportID *string,
	status *string,
	limit int,
) (*ListPatchesResponse, error) {
	q := url.Values{}
	if reportID != nil {
		q.Set("reportId", *reportID)
	}
	if status != nil {
		q.Set("status", *status)
	}
	q.Set("limit", strconv.Itoa(limit))
	var out ListPatchesResponse
	if err := c.doJSON(ctx, http.MethodGet, "/proactive/curator/patches", q, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) DecidePatch(
	ctx context.Context,
	patchID string,
	approve bool,
	by *string,
) (*CuratorPatch, error) {
	var out CuratorPatch
	action := "approve"
	if !approve {
		action = "reject"
	}
	path := "/proactive/curator/patches/" + url.PathEscape(patchID) + "/" + action
	req := DecidePatchRequest{Approve: approve, By: by}
	if err := c.doJSON(ctx, http.MethodPost, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) SchedulerStatus(ctx context.Context) (*SchedulerStatusResponse, error) {
	var out SchedulerStatusResponse
	if err := c.doJSON(ctx, http.MethodGet, "/proactive/scheduler/status", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) SchedulerStart(ctx context.Context) (*SchedulerStatusResponse, error) {
	var out SchedulerStatusResponse
	if err := c.doJSON(ctx, http.MethodPost, "/proactive/scheduler/start", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainProactiveClient) SchedulerStop(ctx context.Context) (*SchedulerStatusResponse, error) {
	var out SchedulerStatusResponse
	if err := c.doJSON(ctx, http.MethodPost, "/proactive/scheduler/stop", nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
