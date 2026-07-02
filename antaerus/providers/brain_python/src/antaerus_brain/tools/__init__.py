from __future__ import annotations

from antaerus_brain.config import Settings
from antaerus_brain.tools.browser import BrowserTool
from antaerus_brain.tools.calendar import CalendarTool
from antaerus_brain.tools.cli import CLITool
from antaerus_brain.tools.filesystem import FilesystemTool
from antaerus_brain.tools.gmail import GmailTool
from antaerus_brain.tools.memory_tool import MemoryTool
from antaerus_brain.tools.tool_registry import ToolRegistry, load_tools_config
from antaerus_brain.tools.vision import VisionTool
from antaerus_brain.tools.weather import WeatherTool


def create_tool_registry(settings: Settings) -> ToolRegistry:
    config = load_tools_config(settings.tools_config_path)
    tools = [
        BrowserTool(settings, config.browser.model_dump()),
        GmailTool(settings, config.gmail.model_dump()),
        CalendarTool(settings, config.calendar.model_dump()),
        WeatherTool(settings, config.weather.model_dump()),
        VisionTool(settings, config.vision.model_dump()),
        FilesystemTool(settings, config.filesystem.model_dump()),
        MemoryTool(settings, config.memory_tool.model_dump()),
        CLITool(settings, config.cli.model_dump()),
    ]
    return ToolRegistry(tools)
