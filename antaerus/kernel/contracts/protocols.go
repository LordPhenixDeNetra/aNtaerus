package contracts

type HealthReader interface {
	ReadHealth() ServiceHealth
}

type CapabilityReader interface {
	ReadCapabilities() ServiceCapabilities
}

type SystemAggregator interface {
	BuildSystemStatus() SystemStatus
}

type EventNotifier interface {
	Publish(event SystemEvent) error
}

type SystemEvent struct {
	Topic   string
	Payload map[string]string
}
