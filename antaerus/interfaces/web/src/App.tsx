import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Analytics from "@/pages/Analytics";
import Chat from "@/pages/Chat";
import CommandCenter from "@/pages/CommandCenter";
import Config from "@/pages/Config";
import FoundationDashboard from "@/pages/FoundationDashboard";
import Home from "@/pages/Home";
import MemoryExplorer from "@/pages/MemoryExplorer";
import Missions from "@/pages/Missions";
import Setup from "@/pages/Setup";
import SystemHealth from "@/pages/SystemHealth";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/foundation" element={<FoundationDashboard />} />
        <Route path="/missions" element={<Missions />} />
        <Route path="/command-center" element={<CommandCenter />} />
        <Route path="/memory" element={<MemoryExplorer />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/system-health" element={<SystemHealth />} />
        <Route path="/config" element={<Config />} />
      </Routes>
    </Router>
  );
}
