use engine_rust::audio::wake_word::{normalize_compact, WakeWordDecision, WakeWordGate};

#[test]
fn normalize_compact_tolerates_case_accents_and_spacing() {
    assert_eq!(normalize_compact("aNtaerus"), "antaerus");
    assert_eq!(normalize_compact("aNtaérus"), "antaerus");
    assert_eq!(normalize_compact("an taerus"), "antaerus");
    assert_eq!(normalize_compact("an-taerus"), "antaerus");
}

#[test]
fn ignores_transcript_without_wake_word() {
    let mut gate = WakeWordGate::new("aNtaerus");

    let decision = gate.evaluate("bonjour a tous");

    assert_eq!(decision, WakeWordDecision::Ignored);
}

#[test]
fn arms_session_without_command_when_transcript_is_wake_word_only() {
    let mut gate = WakeWordGate::new("aNtaerus");

    let decision = gate.evaluate("aNtaerus");

    assert_eq!(decision, WakeWordDecision::ArmedNoCommand);
}

#[test]
fn strips_wake_word_from_first_command() {
    let mut gate = WakeWordGate::new("aNtaerus");

    let decision = gate.evaluate("aNtaérus bonjour comment vas-tu");

    assert_eq!(
        decision,
        WakeWordDecision::ArmedWithCommand("bonjour comment vas-tu".to_string())
    );
}

#[test]
fn accepts_follow_up_utterances_once_session_is_armed() {
    let mut gate = WakeWordGate::new("aNtaerus");

    assert_eq!(gate.evaluate("aNtaerus"), WakeWordDecision::ArmedNoCommand);
    assert_eq!(
        gate.evaluate("quelle heure est-il"),
        WakeWordDecision::PassThrough("quelle heure est-il".to_string())
    );
}
