import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Chat from "@/pages/Chat";
import CommandCenter from "@/pages/CommandCenter";
import FoundationDashboard from "@/pages/FoundationDashboard";
import Home from "@/pages/Home";
import Missions from "@/pages/Missions";
import Setup from "@/pages/Setup";

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
      </Routes>
    </Router>
  );
}
