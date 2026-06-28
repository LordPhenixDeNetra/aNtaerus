package events

import (
	"testing"
	"time"

	"antaerus/kernel/contracts"
)

func TestPublishFanOutsToSubscribers(t *testing.T) {
	t.Parallel()

	bus := NewBus()
	first, err := bus.Subscribe(1)
	if err != nil {
		t.Fatalf("Subscribe() first error = %v", err)
	}
	second, err := bus.Subscribe(1)
	if err != nil {
		t.Fatalf("Subscribe() second error = %v", err)
	}

	event := contracts.SystemEvent{
		Topic: "system.health",
		Payload: map[string]string{
			"status": "healthy",
		},
	}

	if err := bus.Publish(event); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	assertEventReceived(t, first.C, event)
	assertEventReceived(t, second.C, event)
}

func TestSubscriptionCloseStopsDelivery(t *testing.T) {
	t.Parallel()

	bus := NewBus()
	subscription, err := bus.Subscribe(1)
	if err != nil {
		t.Fatalf("Subscribe() error = %v", err)
	}

	subscription.Close()

	if err := bus.Publish(contracts.SystemEvent{Topic: "ignored"}); err != nil {
		t.Fatalf("Publish() error = %v", err)
	}

	if _, ok := <-subscription.C; ok {
		t.Fatal("subscription channel should be closed")
	}
}

func TestCloseStopsFutureSubscriptionsAndPublishes(t *testing.T) {
	t.Parallel()

	bus := NewBus()
	subscription, err := bus.Subscribe(1)
	if err != nil {
		t.Fatalf("Subscribe() error = %v", err)
	}

	bus.Close()

	if _, err := bus.Subscribe(1); err != ErrBusClosed {
		t.Fatalf("Subscribe() error = %v, want %v", err, ErrBusClosed)
	}

	if err := bus.Publish(contracts.SystemEvent{Topic: "closed"}); err != ErrBusClosed {
		t.Fatalf("Publish() error = %v, want %v", err, ErrBusClosed)
	}

	if _, ok := <-subscription.C; ok {
		t.Fatal("subscription channel should be closed after bus close")
	}
}

func assertEventReceived(
	t *testing.T,
	channel <-chan contracts.SystemEvent,
	want contracts.SystemEvent,
) {
	t.Helper()

	select {
	case got := <-channel:
		if got.Topic != want.Topic {
			t.Fatalf("Topic = %q, want %q", got.Topic, want.Topic)
		}
		if got.Payload["status"] != want.Payload["status"] {
			t.Fatalf("Payload[status] = %q, want %q", got.Payload["status"], want.Payload["status"])
		}
	case <-time.After(2 * time.Second):
		t.Fatal("timed out waiting for event")
	}
}
