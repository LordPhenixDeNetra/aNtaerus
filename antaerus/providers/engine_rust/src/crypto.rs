use ring::{
    aead::{self, Aad, LessSafeKey, Nonce, UnboundKey},
    rand::{SecureRandom, SystemRandom},
};

const NONCE_LEN: usize = 12;
const KEY_LEN: usize = 32;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EncryptedSecret {
    nonce: [u8; NONCE_LEN],
    ciphertext: Vec<u8>,
}

impl EncryptedSecret {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut serialized = Vec::with_capacity(NONCE_LEN + self.ciphertext.len());
        serialized.extend_from_slice(&self.nonce);
        serialized.extend_from_slice(&self.ciphertext);
        serialized
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, CryptoError> {
        if bytes.len() <= NONCE_LEN {
            return Err(CryptoError::MalformedCiphertext);
        }

        let mut nonce = [0_u8; NONCE_LEN];
        nonce.copy_from_slice(&bytes[..NONCE_LEN]);

        Ok(Self {
            nonce,
            ciphertext: bytes[NONCE_LEN..].to_vec(),
        })
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum CryptoError {
    InvalidKeyLength,
    RandomnessUnavailable,
    EncryptFailed,
    DecryptFailed,
    MalformedCiphertext,
}

impl std::fmt::Display for CryptoError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidKeyLength => formatter.write_str("invalid AES-256-GCM key length"),
            Self::RandomnessUnavailable => formatter.write_str("system randomness unavailable"),
            Self::EncryptFailed => formatter.write_str("failed to encrypt secret"),
            Self::DecryptFailed => formatter.write_str("failed to decrypt secret"),
            Self::MalformedCiphertext => formatter.write_str("malformed encrypted secret"),
        }
    }
}

impl std::error::Error for CryptoError {}

pub fn encrypt_secret(plaintext: &[u8], key_bytes: &[u8]) -> Result<EncryptedSecret, CryptoError> {
    let key = build_key(key_bytes)?;
    let mut nonce = [0_u8; NONCE_LEN];

    SystemRandom::new()
        .fill(&mut nonce)
        .map_err(|_| CryptoError::RandomnessUnavailable)?;

    let nonce_for_sealing = Nonce::assume_unique_for_key(nonce);
    let mut in_out = plaintext.to_vec();

    key.seal_in_place_append_tag(nonce_for_sealing, Aad::empty(), &mut in_out)
        .map_err(|_| CryptoError::EncryptFailed)?;

    Ok(EncryptedSecret {
        nonce,
        ciphertext: in_out,
    })
}

pub fn decrypt_secret(
    encrypted: &EncryptedSecret,
    key_bytes: &[u8],
) -> Result<Vec<u8>, CryptoError> {
    let key = build_key(key_bytes)?;
    let nonce = Nonce::assume_unique_for_key(encrypted.nonce);
    let mut in_out = encrypted.ciphertext.clone();

    let plaintext = key
        .open_in_place(nonce, Aad::empty(), &mut in_out)
        .map_err(|_| CryptoError::DecryptFailed)?;

    Ok(plaintext.to_vec())
}

fn build_key(key_bytes: &[u8]) -> Result<LessSafeKey, CryptoError> {
    if key_bytes.len() != KEY_LEN {
        return Err(CryptoError::InvalidKeyLength);
    }

    let key = UnboundKey::new(&aead::AES_256_GCM, key_bytes)
        .map_err(|_| CryptoError::InvalidKeyLength)?;

    Ok(LessSafeKey::new(key))
}
