#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WakeWordState {
    Waiting,
    Armed,
}

impl WakeWordState {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Waiting => "waiting",
            Self::Armed => "armed",
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum WakeWordDecision {
    Ignored,
    ArmedNoCommand,
    ArmedWithCommand(String),
    PassThrough(String),
}

pub struct WakeWordGate {
    state: WakeWordState,
    normalized_wake_word: String,
}

impl WakeWordGate {
    pub fn new(wake_word: &str) -> Self {
        let normalized_wake_word = normalize_compact(wake_word);
        let normalized_wake_word = if normalized_wake_word.is_empty() {
            "antaerus".to_string()
        } else {
            normalized_wake_word
        };

        Self {
            state: WakeWordState::Waiting,
            normalized_wake_word,
        }
    }

    pub fn state(&self) -> WakeWordState {
        self.state
    }

    pub fn evaluate(&mut self, transcript: &str) -> WakeWordDecision {
        let cleaned = transcript.trim();
        if cleaned.is_empty() {
            return WakeWordDecision::Ignored;
        }

        if self.state == WakeWordState::Armed {
            return WakeWordDecision::PassThrough(cleaned.to_string());
        }

        match split_command_after_wake_word(cleaned, self.normalized_wake_word.as_str()) {
            Some(command) if command.is_empty() => {
                self.state = WakeWordState::Armed;
                WakeWordDecision::ArmedNoCommand
            }
            Some(command) => {
                self.state = WakeWordState::Armed;
                WakeWordDecision::ArmedWithCommand(command)
            }
            None => WakeWordDecision::Ignored,
        }
    }
}

fn split_command_after_wake_word(transcript: &str, normalized_wake_word: &str) -> Option<String> {
    let tokens: Vec<&str> = transcript.split_whitespace().collect();
    if tokens.is_empty() {
        return None;
    }

    let mut prefix = String::new();
    for (index, token) in tokens.iter().enumerate() {
        let normalized_token = normalize_compact(token);
        if normalized_token.is_empty() {
            continue;
        }

        prefix.push_str(normalized_token.as_str());
        if prefix == normalized_wake_word {
            let remainder = tokens[index + 1..].join(" ");
            return Some(remainder.trim().to_string());
        }

        if !normalized_wake_word.starts_with(prefix.as_str()) {
            return None;
        }
    }

    None
}

pub fn normalize_compact(input: &str) -> String {
    let mut normalized = String::with_capacity(input.len());
    for ch in input.chars() {
        if let Some(mapped) = normalize_char(ch) {
            normalized.push(mapped);
        }
    }
    normalized
}

fn normalize_char(ch: char) -> Option<char> {
    match ch {
        'A'..='Z' => Some(ch.to_ascii_lowercase()),
        'a'..='z' | '0'..='9' => Some(ch),
        '\u{00E0}' | '\u{00E1}' | '\u{00E2}' | '\u{00E3}' | '\u{00E4}' | '\u{00E5}'
        | '\u{0101}' | '\u{0103}' | '\u{0105}' | '\u{00C0}' | '\u{00C1}' | '\u{00C2}'
        | '\u{00C3}' | '\u{00C4}' | '\u{00C5}' | '\u{0100}' | '\u{0102}' | '\u{0104}' => {
            Some('a')
        }
        '\u{00E7}' | '\u{0107}' | '\u{0109}' | '\u{010B}' | '\u{010D}' | '\u{00C7}'
        | '\u{0106}' | '\u{0108}' | '\u{010A}' | '\u{010C}' => Some('c'),
        '\u{00E8}' | '\u{00E9}' | '\u{00EA}' | '\u{00EB}' | '\u{0113}' | '\u{0115}'
        | '\u{0117}' | '\u{0119}' | '\u{011B}' | '\u{00C8}' | '\u{00C9}' | '\u{00CA}'
        | '\u{00CB}' | '\u{0112}' | '\u{0114}' | '\u{0116}' | '\u{0118}' | '\u{011A}' => {
            Some('e')
        }
        '\u{00EC}' | '\u{00ED}' | '\u{00EE}' | '\u{00EF}' | '\u{0129}' | '\u{012B}'
        | '\u{012D}' | '\u{012F}' | '\u{0131}' | '\u{00CC}' | '\u{00CD}' | '\u{00CE}'
        | '\u{00CF}' | '\u{0128}' | '\u{012A}' | '\u{012C}' | '\u{012E}' => Some('i'),
        '\u{00F1}' | '\u{0144}' | '\u{0146}' | '\u{0148}' | '\u{00D1}' | '\u{0143}'
        | '\u{0145}' | '\u{0147}' => Some('n'),
        '\u{00F2}' | '\u{00F3}' | '\u{00F4}' | '\u{00F5}' | '\u{00F6}' | '\u{014D}'
        | '\u{014F}' | '\u{0151}' | '\u{00D2}' | '\u{00D3}' | '\u{00D4}' | '\u{00D5}'
        | '\u{00D6}' | '\u{014C}' | '\u{014E}' | '\u{0150}' => Some('o'),
        '\u{00F9}' | '\u{00FA}' | '\u{00FB}' | '\u{00FC}' | '\u{0169}' | '\u{016B}'
        | '\u{016D}' | '\u{016F}' | '\u{0171}' | '\u{0173}' | '\u{00D9}' | '\u{00DA}'
        | '\u{00DB}' | '\u{00DC}' | '\u{0168}' | '\u{016A}' | '\u{016C}' | '\u{016E}'
        | '\u{0170}' | '\u{0172}' => Some('u'),
        '\u{00FD}' | '\u{00FF}' | '\u{0177}' | '\u{00DD}' | '\u{0176}' | '\u{0178}' => {
            Some('y')
        }
        '\u{0159}' | '\u{0157}' | '\u{0155}' | '\u{0158}' | '\u{0156}' | '\u{0154}' => {
            Some('r')
        }
        '\u{015B}' | '\u{015D}' | '\u{015F}' | '\u{0161}' | '\u{015A}' | '\u{015C}'
        | '\u{015E}' | '\u{0160}' => Some('s'),
        '\u{0165}' | '\u{0163}' | '\u{0164}' | '\u{0162}' => Some('t'),
        '\u{017A}' | '\u{017C}' | '\u{017E}' | '\u{0179}' | '\u{017B}' | '\u{017D}' => {
            Some('z')
        }
        '\u{2019}' | '\u{0027}' | '\u{002D}' | '\u{005F}' | '\u{002E}' | '\u{002C}'
        | '\u{003A}' | '\u{003B}' | '\u{0021}' | '\u{003F}' | '\u{002F}' | '\u{005C}'
        | '\u{0028}' | '\u{0029}' | '\u{005B}' | '\u{005D}' | '\u{007B}' | '\u{007D}'
        | '\u{0022}' | '\u{0060}' | '\u{007E}' | '\u{002B}' | '\u{003D}' | '\u{002A}'
        | '\u{0026}' | '\u{005E}' | '\u{0025}' | '\u{0024}' | '\u{0023}' | '\u{0040}'
        | '\u{003C}' | '\u{003E}' | '\u{007C}' | '\u{0009}' | '\u{000A}' | '\u{000D}'
        | ' ' => None,
        _ if ch.is_ascii_punctuation() || ch.is_whitespace() => None,
        _ => None,
    }
}
