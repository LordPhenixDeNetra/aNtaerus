package settings

import (
	"encoding/json"
	"fmt"
	"testing"
)

func TestSecretStringMasksFormatting(t *testing.T) {
	t.Parallel()

	secret := SecretString("super-secret-value")

	if got := secret.String(); got != maskedSecretValue {
		t.Fatalf("String() = %q, want %q", got, maskedSecretValue)
	}

	if got := fmt.Sprintf("%s", secret); got != maskedSecretValue {
		t.Fatalf("fmt %%s = %q, want %q", got, maskedSecretValue)
	}

	if got := fmt.Sprintf("%#v", secret); got != maskedSecretValue {
		t.Fatalf("fmt %%#v = %q, want %q", got, maskedSecretValue)
	}
}

func TestSecretStringMarshalJSONMasksValue(t *testing.T) {
	t.Parallel()

	payload := struct {
		Secret SecretString `json:"secret"`
	}{
		Secret: SecretString("super-secret-value"),
	}

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("json.Marshal() error = %v", err)
	}

	if got := string(encoded); got != `{"secret":"***"}` {
		t.Fatalf("json.Marshal() = %q, want masked secret", got)
	}
}

func TestSecretStringValueReturnsUnderlyingSecret(t *testing.T) {
	t.Parallel()

	secret := SecretString("super-secret-value")

	if got := secret.Value(); got != "super-secret-value" {
		t.Fatalf("Value() = %q, want raw secret", got)
	}
}

func TestLoadFoundationSettingsUsesSecretString(t *testing.T) {
	t.Parallel()

	settings := LoadFoundationSettings()

	if settings.APISecret.String() != maskedSecretValue {
		t.Fatal("APISecret should remain masked through String()")
	}
}
