import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Chat from "@/pages/Chat";
import FoundationDashboard from "@/pages/FoundationDashboard";
import Setup from "@/pages/Setup";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Chat />} />
        <Route path="/setup" element={<Setup />} />
        <Route path="/foundation" element={<FoundationDashboard />} />
      </Routes>
    </Router>
  );
}
