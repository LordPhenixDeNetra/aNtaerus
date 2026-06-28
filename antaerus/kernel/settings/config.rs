use secrecy::SecretString;

#[derive(Clone, Debug)]
pub struct FoundationSettings {
    pub environment: String,
    pub api_secret: SecretString,
}

impl FoundationSettings {
    pub fn development() -> Self {
        Self {
            environment: "development".to_string(),
            api_secret: SecretString::new("development-secret".to_string().into()),
        }
    }
}
