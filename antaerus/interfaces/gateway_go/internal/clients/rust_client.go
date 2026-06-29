package clients

func NewRustClient(baseURL string) ServiceClient {
	return NewEngineHTTPClient(baseURL)
}

func NewEngineHTTPClient(baseURL string) ServiceClient {
	return ServiceClient{
		Name:             "engine_rust",
		Runtime:          "rust",
		BaseURL:          baseURL,
		HealthPath:       "/health",
		CapabilitiesPath: "/capabilities",
	}
}
