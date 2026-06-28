package settings

import "github.com/spf13/viper"

type SecretString string

func (s SecretString) String() string {
	return "***"
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
