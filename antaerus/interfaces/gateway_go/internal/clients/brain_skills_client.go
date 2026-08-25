package clients

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

type SkillRecord struct {
	ID          string  `json:"id"`
	Name        string  `json:"name"`
	Version     string  `json:"version"`
	Description string  `json:"description"`
	Runtime     string  `json:"runtime"`
	Category    string  `json:"category"`
	Author      string  `json:"author"`
	InstalledAt string  `json:"installedAt"`
	Checksum    string  `json:"checksum"`
	Status      string  `json:"status"`
	SourceCode  string  `json:"sourceCode"`
	CreatedAt   string  `json:"createdAt"`
	UpdatedAt   string  `json:"updatedAt"`
}

type SkillInstallRequest struct {
	Name             string  `json:"name"`
	Version          string  `json:"version"`
	Description      string  `json:"description,omitempty"`
	Runtime          string  `json:"runtime"`
	Category         string  `json:"category,omitempty"`
	Author           string  `json:"author,omitempty"`
	SourceCode       string  `json:"sourceCode,omitempty"`
	SourceTarballB64 *string `json:"sourceTarballB64,omitempty"`
	Trusted          bool    `json:"trusted,omitempty"`
}

type SkillUpdateRequest struct {
	Name        *string `json:"name,omitempty"`
	Version     *string `json:"version,omitempty"`
	Description *string `json:"description,omitempty"`
	Category    *string `json:"category,omitempty"`
	SourceCode  *string `json:"sourceCode,omitempty"`
	Status      *string `json:"status,omitempty"`
}

type SkillRunRequest struct {
	ArgsJSON  string `json:"argsJson"`
	TimeoutMs int    `json:"timeoutMs,omitempty"`
	FuelLimit  int    `json:"fuelLimit,omitempty"`
}

type SkillRunResult struct {
	ExitCode     int    `json:"exitCode"`
	Stdout       string `json:"stdout"`
	Stderr       string `json:"stderr"`
	DurationMs   int    `json:"durationMs"`
	FuelUsed     *int   `json:"fuelUsed,omitempty"`
	SandboxKind  string `json:"sandboxKind"`
	Error        *string `json:"error,omitempty"`
}

type SkillApprovalDecision struct {
	Approve bool    `json:"approve"`
	By      *string `json:"by,omitempty"`
	Reason  string  `json:"reason,omitempty"`
}

type SkillListResponse struct {
	Items []SkillRecord `json:"items"`
	Total int           `json:"total"`
}

type BrainSkillsClient struct {
	httpClient     httpClient
	baseURL        string
	requestTimeout time.Duration
}

func NewBrainSkillsClient(
	httpClient *http.Client,
	baseURL string,
	requestTimeout time.Duration,
) BrainSkillsClient {
	client := httpClient
	if client == nil {
		client = &http.Client{Timeout: requestTimeout}
	}
	return BrainSkillsClient{
		httpClient:     client,
		baseURL:        strings.TrimRight(baseURL, "/"),
		requestTimeout: requestTimeout,
	}
}

func (c BrainSkillsClient) doJSON(
	ctx context.Context,
	method string,
	path string,
	query url.Values,
	body any,
	out any,
) error {
	var proactive *BrainProactiveClient
	_ = proactive
	dummy := NewBrainProactiveClient(nil, c.baseURL, c.requestTimeout)
	return dummy.doJSON(ctx, method, path, query, body, out)
}

func (c BrainSkillsClient) ListSkills(
	ctx context.Context,
	category *string,
	runtime *string,
	status *string,
	search *string,
	limit int,
	offset int,
) (*SkillListResponse, error) {
	q := url.Values{}
	if category != nil {
		q.Set("category", *category)
	}
	if runtime != nil {
		q.Set("runtime", *runtime)
	}
	if status != nil {
		q.Set("status", *status)
	}
	if search != nil {
		q.Set("search", *search)
	}
	q.Set("limit", strconv.Itoa(limit))
	q.Set("offset", strconv.Itoa(offset))
	var out SkillListResponse
	if err := c.doJSON(ctx, http.MethodGet, "/skills", q, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) GetSkill(ctx context.Context, id string) (*SkillRecord, error) {
	var out SkillRecord
	path := "/skills/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodGet, path, nil, nil, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) InstallSkill(
	ctx context.Context,
	req SkillInstallRequest,
) (*SkillRecord, error) {
	var out SkillRecord
	if err := c.doJSON(ctx, http.MethodPost, "/skills", nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) UpdateSkill(
	ctx context.Context,
	id string,
	req SkillUpdateRequest,
) (*SkillRecord, error) {
	var out SkillRecord
	path := "/skills/" + url.PathEscape(id)
	if err := c.doJSON(ctx, http.MethodPut, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) UninstallSkill(ctx context.Context, id string) error {
	path := "/skills/" + url.PathEscape(id)
	return c.doJSON(ctx, http.MethodDelete, path, nil, nil, nil)
}

func (c BrainSkillsClient) RunSkill(
	ctx context.Context,
	id string,
	req SkillRunRequest,
) (*SkillRunResult, error) {
	var out SkillRunResult
	path := "/skills/" + url.PathEscape(id) + "/run"
	if err := c.doJSON(ctx, http.MethodPost, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) ApproveSkill(
	ctx context.Context,
	id string,
	by *string,
	reason string,
) (*SkillRecord, error) {
	var out SkillRecord
	path := "/skills/" + url.PathEscape(id) + "/approve"
	req := SkillApprovalDecision{Approve: true, By: by, Reason: reason}
	if err := c.doJSON(ctx, http.MethodPost, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c BrainSkillsClient) RejectSkill(
	ctx context.Context,
	id string,
	by *string,
	reason string,
) (*SkillRecord, error) {
	var out SkillRecord
	path := "/skills/" + url.PathEscape(id) + "/reject"
	req := SkillApprovalDecision{Approve: false, By: by, Reason: reason}
	if err := c.doJSON(ctx, http.MethodPost, path, nil, req, &out); err != nil {
		return nil, err
	}
	return &out, nil
}
