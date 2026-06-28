package events

import (
	"errors"
	"sync"

	"antaerus/kernel/contracts"
)

var (
	ErrBusClosed              = errors.New("event bus is closed")
	ErrSubscriberBackpressure = errors.New("subscriber buffer is full")
)

type Subscription struct {
	C      <-chan contracts.SystemEvent
	cancel func()
}

func (subscription Subscription) Close() {
	if subscription.cancel != nil {
		subscription.cancel()
	}
}

type Bus struct {
	mu          sync.RWMutex
	subscribers map[uint64]chan contracts.SystemEvent
	nextID      uint64
	closed      bool
}

func NewBus() *Bus {
	return &Bus{
		subscribers: make(map[uint64]chan contracts.SystemEvent),
	}
}

func (bus *Bus) Subscribe(bufferSize int) (Subscription, error) {
	bus.mu.Lock()
	defer bus.mu.Unlock()

	if bus.closed {
		return Subscription{}, ErrBusClosed
	}

	channel := make(chan contracts.SystemEvent, bufferSize)
	id := bus.nextID
	bus.nextID++
	bus.subscribers[id] = channel

	return Subscription{
		C: channel,
		cancel: func() {
			bus.unsubscribe(id)
		},
	}, nil
}

func (bus *Bus) Publish(event contracts.SystemEvent) error {
	bus.mu.RLock()
	defer bus.mu.RUnlock()

	if bus.closed {
		return ErrBusClosed
	}

	for _, subscriber := range bus.subscribers {
		select {
		case subscriber <- event:
		default:
			return ErrSubscriberBackpressure
		}
	}

	return nil
}

func (bus *Bus) Close() {
	bus.mu.Lock()
	defer bus.mu.Unlock()

	if bus.closed {
		return
	}

	bus.closed = true

	for id, subscriber := range bus.subscribers {
		close(subscriber)
		delete(bus.subscribers, id)
	}
}

func (bus *Bus) unsubscribe(id uint64) {
	bus.mu.Lock()
	defer bus.mu.Unlock()

	channel, ok := bus.subscribers[id]
	if !ok {
		return
	}

	delete(bus.subscribers, id)
	close(channel)
}
