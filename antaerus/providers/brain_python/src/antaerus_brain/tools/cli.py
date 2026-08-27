from __future__ import annotations

from pydantic import BaseModel, Field

from antaerus_brain.tools.base import BaseTool
from antaerus_brain.tools.rust_proxy import RustToolProxyError, execute_rust_tool


class CLIToolInput(BaseModel):
    command: str = Field(
        min_length=1,
        description=(
            "Nom du programme a executer (whitelist: python, git, go, cargo, npm, explorer, "
            "vlc, wmplayer, msedge, cmd, powershell, pwsh, rundll32). "
            "SUR WINDOWS: POUR OUVRIR UN FICHIER (musique, image, PDF...) AVEC L'APPLICATION "
            "PAR DEFAUT DE L'UTILISATEUR, UTILISER **OBLIGATOIREMENT** command='cmd.exe' ET "
            "args=['/c', 'start', '', '<CHEMIN_COMPLET_DU_FICHIER>']. "
            "Exemple lire une musique MP3: cmd.exe args=['/c','start','','C:/Users/Toi/Music/abc.mp3']."
            " 'start' est un built-in cmd.exe et ne marche PAS comme programme direct."
        ),
    )
    args: list[str] = Field(default_factory=list)
    timeout_seconds: float | None = Field(default=None, gt=0)


class CLITool(BaseTool):
    name = "cli"
    description = (
        "Execute un programme liste dans la whitelist (shell libre interdit). "
        "Sert a ouvrir des logiciels ou a executer des commandes developpement. "
        "ATTENTION: 'start' n'est PAS un programme (c'est un builtin cmd.exe). "
        "Pour jouer un fichier audio/video/image/pdf ou lancer l'app par defaut d'un type de fichier, "
        "toujours utiliser: command=cmd.exe args=['/c', 'start', '', '<chemin_absolu_du_fichier>']."
    )
    risk_level = "high"
    category = "rust-sandbox"
    autonomy_level = 3
    input_model = CLIToolInput
    operations = ("exec",)

    async def _run(self, payload: CLIToolInput):
        try:
            return await execute_rust_tool(
                self.settings,
                tool=self.name,
                endpoint="/internal/tools/cli/execute",
                payload=payload.model_dump(),
            )
        except RustToolProxyError as exc:
            return self.error_result(str(exc))
