use std::{env, fs, path::PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let proto_root = manifest_dir.join("../../../kernel/proto");
    let engine_proto = proto_root.join("engine.proto");
    let audio_proto = proto_root.join("audio.proto");
    let output_dir = manifest_dir.join("../../src/gen");

    if env::var_os("PROTOC").is_none() {
        let local_appdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let windows_bundle = PathBuf::from(local_appdata)
            .join("protoc-29.3")
            .join("bin")
            .join("protoc.exe");

        if windows_bundle.exists() {
            env::set_var("PROTOC", windows_bundle);
        }
    }

    fs::create_dir_all(&output_dir).expect("failed to create Rust proto output directory");

    tonic_build::configure()
        .build_server(true)
        .build_client(false)
        .out_dir(&output_dir)
        .compile_protos(&[engine_proto, audio_proto], &[proto_root])
        .expect("failed to generate Rust gRPC stubs");
}
