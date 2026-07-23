import { NavLink, Route, Routes } from "react-router-dom";
import { BookOpen, BarChart3, Dumbbell, UserRound } from "lucide-react";

import BodyPage from "./features/body/BodyPage";
import DiaryPage from "./features/diary/DiaryPage";
import TrainingPage from "./features/training/TrainingPage";
import StatisticsPage from "./features/statistics/StatisticsPage";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">3    
          <Mountain />
        </div>

        <div>
          <h1>Vertical Progress</h1>
          <p>Bouldern, Training, Körperdaten und Statistik.</p>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<DiaryPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/body" element={<BodyPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="*" element={<DiaryPage />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavItem to="/" icon={<BookOpen size={20} />} label="Tagebuch" />
        <NavItem to="/training" icon={<Dumbbell size={20} />} label="Training" />
        <NavItem to="/body" icon={<UserRound size={20} />} label="Körper" />
        <NavItem
          to="/statistics"
          icon={<BarChart3 size={20} />}
          label="Statistik"
        />
      </nav>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
    >
      {icon}
      <span>{label}</span>
    </NavLink>
  );
}