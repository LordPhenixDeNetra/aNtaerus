package scheduler

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"antaerus/interfaces/gateway_go/internal/clients"
	"antaerus/interfaces/gateway_go/internal/contracts"
)

type BroadcastFn func(msg contracts.ServerMessage)

type CronScheduler struct {
	mu sync.Mutex

	client      clients.BrainProactiveClient
	broadcastFn BroadcastFn
	interval    time.Duration
	cronHour    int

	running   bool
	stopCh    chan struct{}
	stoppedCh chan struct{}
	lastRun   *time.Time
}

type Status struct {
	Running  bool      `json:"running"`
	CronHour int       `json:"cronHour"`
	Interval string    `json:"interval"`
	LastRun  time.Time `json:"lastRun"`
	HasRun   bool      `json:"hasRun"`
}

func NewCronScheduler(
	client clients.BrainProactiveClient,
	broadcastFn BroadcastFn,
	interval time.Duration,
	cronHour int,
) *CronScheduler {
	if interval <= 0 {
		interval = 60 * time.Second
	}
	if cronHour < 0 || cronHour > 23 {
		cronHour = 2
	}
	return &CronScheduler{
		client:      client,
		broadcastFn: broadcastFn,
		interval:    interval,
		cronHour:    cronHour,
		stopCh:      make(chan struct{}),
		stoppedCh:   make(chan struct{}),
	}
}

func (s *CronScheduler) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	st := Status{
		Running:  s.running,
		CronHour: s.cronHour,
		Interval: s.interval.String(),
		HasRun:   s.lastRun != nil,
	}
	if s.lastRun != nil {
		st.LastRun = *s.lastRun
	}
	return st
}

func (s *CronScheduler) SetCronHour(hour int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if hour >= 0 && hour <= 23 {
		s.cronHour = hour
	}
}

func (s *CronScheduler) Start() {
	s.mu.Lock()
	if s.running {
		s.mu.Unlock()
		return
	}
	s.running = true
	s.stopCh = make(chan struct{})
	s.stoppedCh = make(chan struct{})
	stoppedCh := s.stoppedCh
	stopCh := s.stopCh
	interval := s.interval
	s.mu.Unlock()

	go func() {
		defer close(stoppedCh)
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		s.tick()
		for {
			select {
			case <-stopCh:
				return
			case <-ticker.C:
				s.tick()
			}
		}
	}()
}

func (s *CronScheduler) Stop() {
	s.mu.Lock()
	if !s.running {
		s.mu.Unlock()
		return
	}
	s.running = false
	close(s.stopCh)
	stoppedCh := s.stoppedCh
	s.mu.Unlock()
	<-stoppedCh
}

func (s *CronScheduler) tick() {
	s.mu.Lock()
	cronHour := s.cronHour
	s.mu.Unlock()
	now := time.Now().UTC()
	// Curator nocturne: run once per day approximately at cronHour UTC
	if now.Hour() == cronHour {
		s.runCuratorOnce(now)
	}
	_ = now
}

func (s *CronScheduler) runCuratorOnce(now time.Time) {
	s.mu.Lock()
	if s.lastRun != nil {
		elapsed := now.Sub(*s.lastRun)
		if elapsed < 20*time.Hour {
			s.mu.Unlock()
			return
		}
	}
	s.lastRun = &now
	s.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), 180*time.Second)
	defer cancel()
	report, err := s.client.CuratorRun(ctx)
	if err != nil {
		return
	}
	if report == nil {
		return
	}
	if s.broadcastFn != nil {
		data, _ := json.Marshal(map[string]any{
			"reportId": report.ID,
			"notes":    report.Notes,
			"patches":  report.TopPatchesCount,
			"ranAt":    now.UTC().Format(time.RFC3339Nano),
		})
		msg := contracts.ServerMessage{
			Envelope: contracts.Envelope{
				Type:      string(contracts.ServerMessageProactiveNotification),
				Timestamp: now.UTC().Format(time.RFC3339Nano),
			},
			Payload: data,
		}
		s.broadcastFn(msg)
	}
	_ = "noop"
}
