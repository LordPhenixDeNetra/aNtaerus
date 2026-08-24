package clients

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

type StepResult struct {
	StepID     string                 `json:"step_id"`
	OK         bool                   `json:"ok"`
	Status     string                 `json:"status"`
	Output     string                 `json:"output,omitempty"`
	ToolName   *string                `json:"tool_name,omitempty"`
	ToolArgs   map[string]interface{} `json:"tool_args,omitempty"`
	Raw        map[string]interface{} `json:"raw,omitempty"`
	StartedAt  *string                `json:"started_at,omitempty"`
	FinishedAt *string                `json:"finished_at,omitempty"`
	Error      *string                `json:"error,omitempty"`
}

type MissionStep struct {
	ID             string                 `json:"id"`
	Index          int                    `json:"index"`
	Title          string                 `json:"title"`
	Description    string                 `json:"description,omitempty"`
	ToolName       *string                `json:"tool_name,omitempty"`
	ToolArgs       map[string]interface{} `json:"tool_args,omitempty"`
	DependsOn      []int                  `json:"depends_on,omitempty"`
	ExpectedOutput *string                `json:"expected_output,omitempty"`
	Status         string                 `json:"status"`
	Result         *StepResult            `json:"result,omitempty"`
	Error          *string                `json:"error,omitempty"`
	StartedAt      *string                `json:"started_at,omitempty"`
	FinishedAt     *string                `json:"finished_at,omitempty"`
}

type Mission struct {
	ID            string       `json:"id"`
	SessionID     *string      `json:"session_id,omitempty"`
	Title         string       `json:"title"`
	UserRequest   string       `json:"user_request"`
	Plan          string       `json:"plan,omitempty"`
	Steps         []MissionStep `json:"steps,omitempty"`
	Status        string       `json:"status"`
	AutonomyLevel int          `json:"autonomy_level"`
	BudgetTokens  int          `json:"budget_tokens"`
	UsedTokens    int          `json:"used_tokens"`
	CreatedAt     string       `json:"created_at"`
	UpdatedAt     string       `json:"updated_at"`
	StartedAt     *string      `json:"started_at,omitempty"`
	CompletedAt   *string      `json:"completed_at,omitempty"`
	Error         *string      `json:"error,omitempty"`
}

type ReflexionReport struct {
	MissionID       string   `json:"mission_id"`
	Summary         string   `json:"summary"`
	Successes       []string `json:"successes,omitempty"`
	Failures        []string `json:"failures,omitempty"`
	SuggestedFixes  []string `json:"suggested_fixes,omitempty"`
	FactsToRemember []string `json:"facts_to_remember,omitempty"`
	Warnings        []string `json:"warnings,omitempty"`
	ScoreQuality    float64  `json:"score_quality"`
	GeneratedAt     string   `json:"generated_at"`
}

type MissionEvent struct {
	ID        string                 `json:"id"`
	MissionID string                 `json:"mission_id"`
	StepID    *string                `json:"step_id,omitempty"`
	Kind      string                 `json:"kind"`
	Payload   map[string]interface{} `json:"payload"`
	CreatedAt string                 `json:"created_at"`
}

type CreateMissionRequest struct {
	SessionID     *string `json:"session_id,omitempty"`
	UserRequest   string  `json:"user_request"`
	Provider      *string `json:"provider,omitempty"`
	Model         *string `json:"model,omitempty"`
	AutonomyLevel *int    `json:"autonomy_level,omitempty"`
}

type ListMissionsResponse struct {
	Items []Mission `json:"items"`
	Total int       `json:"total"`
}

type MissionEventsResponse struct {
	Items []MissionEvent `json:"items"`
}

type BrainMissionClient struct {
	httpClient     httpClient
	baseURL        string
	requestTimeout time.Duration
}

func NewBrainMissionClient(
	httpClient *http.Client,
	baseURL string,
	requestTimeout time.Duration,
) BrainMissionClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: requestTimeout}
	}
	return BrainMissionClient{
		httpClient:     client,
		baseURL:        strings.TrimRight(baseURL, "/"),
		requestTimeout: requestTimeout,
	}
}

type BrainMissionError struct {
	StatusCode int
	Body       string
}

func (err BrainMissionError) Error() string {
	return fmt.Sprintf("brain mission HTTP %d: %s", err.StatusCode, err.Body)
}

func (client BrainMissionClient) doJSON(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	in any,
	out any,
) error {
	requestCtx, cancel := context.WithTimeout(ctx, client.requestTimeout)
	defer cancel()
	var body io.Reader
	if in != nil {
		buf, err := json.Marshal(in)
		if err != nil {
			return fmt.Errorf("marshal mission request: %w", err)
		}
		body = bytes.NewReader(buf)
	}
	rawURL := client.baseURL + path
	if query != nil && len(query) > 0 {
		rawURL += "?" + query.Encode()
	}
	request, err := http.NewRequestWithContext(requestCtx, method, rawURL, body)
	if err != nil {
		return fmt.Errorf("build mission request: %w", err)
	}
	if in != nil {
		request.Header.Set("Content-Type", "application/json")
	}
	request.Header.Set("Accept", "application/json")
	response, err := client.httpClient.Do(request)
	if err != nil {
		return fmt.Errorf("brain mission unavailable: %w", err)
	}
	defer closeBody(response)
	rawBody, err := io.ReadAll(response.Body)
	if err != nil {
		return fmt.Errorf("read mission response: %w", err)
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return BrainMissionError{StatusCode: response.StatusCode, Body: string(rawBody)}
	}
	if out == nil {
		return nil
	}
	if err := json.Unmarshal(rawBody, out); err != nil {
		return fmt.Errorf("decode mission response: %w", err)
	}
	return nil
}

func (client BrainMissionClient) CreateMission(
	ctx context.Context,
	req CreateMissionRequest,
) (Mission, error) {
	var out Mission
	err := client.doJSON(ctx, http.MethodPost, "/missions", nil, req, &out)
	return out, err
}

func (client BrainMissionClient) ListMissions(
	ctx context.Context,
	sessionID *string,
	status *string,
	limit *int,
) (ListMissionsResponse, error) {
	query := url.Values{}
	if sessionID != nil {
		query.Set("sessionId", *sessionID)
	}
	if status != nil {
		query.Set("status", *status)
	}
	if limit != nil {
		query.Set("limit", fmt.Sprintf("%d", *limit))
	}
	var out ListMissionsResponse
	err := client.doJSON(ctx, http.MethodGet, "/missions", query, nil, &out)
	return out, err
}

func (client BrainMissionClient) GetMission(
	ctx context.Context,
	missionID string,
) (Mission, error) {
	var out Mission
	err := client.doJSON(ctx, http.MethodGet, "/missions/"+url.PathEscape(missionID), nil, nil, &out)
	return out, err
}

func (client BrainMissionClient) RunMission(
	ctx context.Context,
	missionID string,
	provider *string,
	model *string,
) (Mission, error) {
	query := url.Values{}
	if provider != nil {
		query.Set("provider", *provider)
	}
	if model != nil {
		query.Set("model", *model)
	}
	var out Mission
	err := client.doJSON(ctx, http.MethodPost, "/missions/"+url.PathEscape(missionID)+"/run", query, nil, &out)
	return out, err
}

func (client BrainMissionClient) RecoverMission(
	ctx context.Context,
	missionID string,
) (Mission, error) {
	var out Mission
	err := client.doJSON(ctx, http.MethodPost, "/missions/"+url.PathEscape(missionID)+"/recover", nil, nil, &out)
	return out, err
}

func (client BrainMissionClient) ReflectMission(
	ctx context.Context,
	missionID string,
	provider *string,
	model *string,
) (ReflexionReport, error) {
	query := url.Values{}
	if provider != nil {
		query.Set("provider", *provider)
	}
	if model != nil {
		query.Set("model", *model)
	}
	var out ReflexionReport
	err := client.doJSON(ctx, http.MethodPost, "/missions/"+url.PathEscape(missionID)+"/reflect", query, nil, &out)
	return out, err
}

func (client BrainMissionClient) ListMissionEvents(
	ctx context.Context,
	missionID string,
) (MissionEventsResponse, error) {
	var out MissionEventsResponse
	err := client.doJSON(ctx, http.MethodGet, "/missions/"+url.PathEscape(missionID)+"/events", nil, nil, &out)
	return out, err
}
