from __future__ import annotations

import base64
import hashlib
import io
import shutil
import tarfile
from pathlib import Path

from antaerus_brain.skills import (
    SkillRecord,
    SkillRuntime,
    SkillStatus,
)
from antaerus_brain.skills.registry import SkillRegistry


def _sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _b64_decode(raw: str) -> bytes:
    return base64.b64decode(raw.encode("ascii"), validate=False)


class SkillLifecycleManager:
    def __init__(
        self,
        registry: SkillRegistry,
        *,
        skills_root: Path,
    ) -> None:
        self.registry = registry
        self.skills_root = skills_root

    async def install_from_source_code(
        self,
        *,
        name: str,
        version: str,
        runtime: SkillRuntime,
        source_code: str,
        description: str = "",
        category: str = "general",
        author: str = "",
        trusted: bool = False,
    ) -> SkillRecord:
        existing = await self.registry.get_by_name_version(name, version)
        status: SkillStatus = "installed" if trusted else "pending_approval"
        if existing is not None:
            return await self._reinstall_existing(
                existing,
                source_code=source_code,
                description=description or existing.description,
                category=category or existing.category,
                author=author or existing.author,
                trusted=trusted,
            )
        record = await self.registry.create(
            name=name,
            version=version,
            runtime=runtime,
            description=description,
            category=category,
            author=author,
            source_code=source_code,
            status=status,
        )
        await self._materialize_source(record, source_code)
        return record

    async def install_from_tarball_b64(
        self,
        *,
        name: str,
        version: str,
        runtime: SkillRuntime,
        source_tarball_b64: str,
        description: str = "",
        category: str = "general",
        author: str = "",
        trusted: bool = False,
    ) -> SkillRecord:
        tarball_bytes = _b64_decode(source_tarball_b64)
        checksum = _sha256_bytes(tarball_bytes)
        source_code = await self._extract_source_from_tarball(tarball_bytes)
        existing = await self.registry.get_by_name_version(name, version)
        status: SkillStatus = "installed" if trusted else "pending_approval"
        if existing is not None:
            patched = await self.registry.patch(
                existing.id,
                source_code=source_code,
                checksum=checksum,
                status=status,
                description=description or existing.description,
                category=category or existing.category,
                author=author or existing.author,
            )
            if patched is not None:
                await self._materialize_source(patched, source_code)
                return patched
        record = await self.registry.create(
            name=name,
            version=version,
            runtime=runtime,
            description=description,
            category=category,
            author=author,
            source_code=source_code,
            status=status,
        )
        combined = f"{source_code}{tarball_bytes!r}"
        full_checksum = _sha256_bytes(combined.encode("utf-8"))
        await self.registry.patch(record.id, checksum=full_checksum or checksum)
        await self._materialize_source(record, source_code)
        refreshed = await self.registry.get(record.id)
        return refreshed or record

    async def update(
        self,
        skill_id: str,
        *,
        source_code: str | None = None,
        name: str | None = None,
        version: str | None = None,
        description: str | None = None,
        category: str | None = None,
    ) -> SkillRecord | None:
        existing = await self.registry.get(skill_id)
        if existing is None:
            return None
        fields: dict[str, object] = {}
        if name is not None:
            fields["name"] = name
        if version is not None:
            fields["version"] = version
        if description is not None:
            fields["description"] = description
        if category is not None:
            fields["category"] = category
        if source_code is not None:
            fields["source_code"] = source_code
        if source_code is not None or name is not None or version is not None:
            fields["status"] = "pending_approval"
        patched = await self.registry.patch(skill_id, **fields)
        if patched is not None and source_code is not None:
            await self._materialize_source(patched, source_code)
        return patched

    async def uninstall(self, skill_id: str) -> bool:
        existing = await self.registry.get(skill_id)
        if existing is None:
            return False
        await self._remove_materialized(existing)
        return await self.registry.delete(skill_id)

    async def _reinstall_existing(
        self,
        existing: SkillRecord,
        *,
        source_code: str,
        description: str,
        category: str,
        author: str,
        trusted: bool,
    ) -> SkillRecord:
        status: SkillStatus = "installed" if trusted else "pending_approval"
        patched = await self.registry.patch(
            existing.id,
            source_code=source_code,
            description=description,
            category=category,
            author=author,
            status=status,
        )
        if patched is None:
            raise RuntimeError(f"failed to patch skill {existing.id}")
        await self._materialize_source(patched, source_code)
        return patched

    async def _materialize_source(self, record: SkillRecord, source_code: str) -> Path:
        target = self.skills_root / record.id
        target.mkdir(parents=True, exist_ok=True)
        filename = "skill.py" if record.runtime == "python" else "skill.wat"
        filepath = target / filename
        filepath.write_text(source_code, encoding="utf-8")
        manifest = target / "manifest.json"
        manifest.write_text(record.model_dump_json(indent=2), encoding="utf-8")
        return filepath

    async def _remove_materialized(self, record: SkillRecord) -> None:
        target = self.skills_root / record.id
        if target.exists() and target.is_dir():
            shutil.rmtree(target, ignore_errors=True)

    async def _extract_source_from_tarball(self, tarball_bytes: bytes) -> str:
        buf = io.BytesIO(tarball_bytes)
        fragments: list[str] = []
        suffixes = (".py", ".wat", ".wast", ".md", ".txt")
        try:
            with tarfile.open(fileobj=buf, mode="r:gz") as tar:
                members = []
                for m in tar.getmembers():
                    if not m.isfile():
                        continue
                    if m.name.startswith("..") or "\x00" in m.name:
                        continue
                    head = m.name.split("/", 1)[0]
                    if head.startswith("_"):
                        continue
                    members.append(m)
                def _sort_key(member):
                    return (
                        not member.name.endswith((".py", ".wat", ".wast")),
                        member.name,
                    )
                for member in sorted(members, key=_sort_key):
                    try:
                        extracted = tar.extractfile(member)
                        if extracted is None:
                            continue
                        raw = extracted.read()
                    except (KeyError, tarfile.ExtractError):
                        continue
                    try:
                        text = raw.decode("utf-8")
                    except UnicodeDecodeError:
                        continue
                    if any(member.name.endswith(s) for s in suffixes):
                        fragments.append(f"# --- {member.name} ---\n{text.rstrip()}\n")
        except tarfile.TarError:
            if fragments:
                pass
            else:
                raise
        if not fragments:
            try:
                fragments.append(tarball_bytes.decode("utf-8"))
            except UnicodeDecodeError as exc:
                raise ValueError(
                    "tarball ne contient aucun fichier source python/wat lisible"
                ) from exc
        return "\n".join(fragments)
