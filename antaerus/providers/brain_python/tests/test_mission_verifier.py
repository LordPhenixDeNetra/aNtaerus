from __future__ import annotations

from antaerus_brain.mission.schemas import Mission, MissionStep
from antaerus_brain.mission.verifier import StructuralVerifier


def test_verifier_separates_warnings_and_errors():
    mission = Mission(
        id="m",
        title="T",
        user_request="r",
        status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="", description=""),
            MissionStep(id="s1", index=0, title="Duplicate index", tool_args={"x": 1}),
        ],
    )
    v = StructuralVerifier()
    r = v.verify(mission)
    assert r.ok is False
    errors = "\n".join(r.errors)
    assert "title vide" in errors
    assert "consecutifs ou en double" in errors
    assert any("tool_args sans tool_name" in w for w in r.warnings)


def test_verifier_forbid_unknown_tool_with_list():
    mission = Mission(
        id="m", title="T", user_request="r", status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="ok", tool_name="weather"),
            MissionStep(id="s1", index=1, title="bad", tool_name="send_sms"),
        ],
    )
    v = StructuralVerifier(allowed_tool_names=["weather"])
    r = v.verify(mission)
    assert not r.ok
    assert any("send_sms" in e for e in r.errors)


def test_verifier_none_allowed_tools_ok_with_null_tool_name():
    mission = Mission(
        id="m", title="T", user_request="r", status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="reflect only"),
        ],
    )
    v = StructuralVerifier(allowed_tool_names=[])
    r = v.verify(mission)
    assert r.ok is True


def test_verifier_expected_output_too_long_warns():
    mission = Mission(
        id="m", title="T", user_request="r", status="planned",
        steps=[
            MissionStep(id="s0", index=0, title="S0", expected_output="x" * 3000),
        ],
    )
    v = StructuralVerifier()
    r = v.verify(mission)
    assert r.ok is True
    assert any("trop long" in w for w in r.warnings)
