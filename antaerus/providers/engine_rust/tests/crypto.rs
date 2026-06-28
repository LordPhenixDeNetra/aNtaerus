use engine_rust::crypto::{decrypt_secret, encrypt_secret, CryptoError, EncryptedSecret};

const VALID_KEY: &[u8; 32] = b"0123456789abcdef0123456789abcdef";
const WRONG_KEY: &[u8; 32] = b"fedcba9876543210fedcba9876543210";

#[test]
fn encrypt_and_decrypt_secret_round_trip() {
    let encrypted = encrypt_secret(b"top-secret-value", VALID_KEY).expect("encryption should work");
    let decrypted = decrypt_secret(&encrypted, VALID_KEY).expect("decryption should work");

    assert_eq!(decrypted, b"top-secret-value");
    assert_ne!(encrypted.to_bytes(), b"top-secret-value");
}

#[test]
fn decrypt_secret_rejects_wrong_key() {
    let encrypted = encrypt_secret(b"top-secret-value", VALID_KEY).expect("encryption should work");
    let error = decrypt_secret(&encrypted, WRONG_KEY).expect_err("wrong key should fail");

    assert_eq!(error, CryptoError::DecryptFailed);
}

#[test]
fn decrypt_secret_rejects_tampered_ciphertext() {
    let encrypted = encrypt_secret(b"top-secret-value", VALID_KEY).expect("encryption should work");
    let mut bytes = encrypted.to_bytes();
    let last_index = bytes.len() - 1;
    bytes[last_index] ^= 0xFF;

    let tampered = EncryptedSecret::from_bytes(&bytes).expect("payload should deserialize");
    let error = decrypt_secret(&tampered, VALID_KEY).expect_err("tampered payload should fail");

    assert_eq!(error, CryptoError::DecryptFailed);
}

#[test]
fn encrypted_secret_rejects_short_payload() {
    let error = EncryptedSecret::from_bytes(&[1, 2, 3]).expect_err("payload should be invalid");

    assert_eq!(error, CryptoError::MalformedCiphertext);
}
