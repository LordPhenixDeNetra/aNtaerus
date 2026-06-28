package contracts

type ServiceHealth struct {
	Name      string
	Status    string
	Version   string
	Port      int
	URL       string
	CheckedAt string
	Details   string
}

type ServiceCapabilities struct {
	Name         string
	Version      string
	Runtime      string
	Capabilities []string
}

type SystemStatus struct {
	Product      string
	Phase        string
	Environment  string
	Services     []ServiceHealth
	Capabilities []ServiceCapabilities
}
