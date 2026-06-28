use engine_rust::config::Settings;
use secrecy::ExposeSecret;

#[test]
fn settings_debug_representation_does_not_leak_secret() {
    let settings = Settings::from_env();
    let debug_output = format!("{settings:?}");

    assert!(!debug_output.contains("development-secret"));
    assert!(debug_output.contains("Secret"));
}

#[test]
fn settings_keep_secret_value_available_explicitly() {
    let settings = Settings::from_env();

    assert_eq!(settings.api_secret.expose_secret(), "development-secret");
}
