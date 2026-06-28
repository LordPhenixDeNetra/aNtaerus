import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import FoundationDashboard from "@/pages/FoundationDashboard";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FoundationDashboard />} />
      </Routes>
    </Router>
  );
}
