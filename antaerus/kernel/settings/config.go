package settings

import (
	"encoding/json"

	"github.com/spf13/viper"
)

type SecretString string

const maskedSecretValue = "***"

func (s SecretString) String() string {
	return maskedSecretValue
}

func (s SecretString) GoString() string {
	return maskedSecretValue
}

func (s SecretString) MarshalJSON() ([]byte, error) {
	return json.Marshal(maskedSecretValue)
}

func (s SecretString) MarshalText() ([]byte, error) {
	return []byte(maskedSecretValue), nil
}

func (s SecretString) Value() string {
	return string(s)
}

type FoundationSettings struct {
	Environment string
	APISecret   SecretString
}

func LoadFoundationSettings() FoundationSettings {
	config := viper.New()
	config.SetDefault("ANTAERUS_ENV", "development")
	config.SetDefault("ANTAERUS_API_SECRET", "development-secret")
	config.AutomaticEnv()

	return FoundationSettings{
		Environment: config.GetString("ANTAERUS_ENV"),
		APISecret:   SecretString(config.GetString("ANTAERUS_API_SECRET")),
	}
}
