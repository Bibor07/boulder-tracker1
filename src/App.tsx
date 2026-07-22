import { NavLink, Route, Routes } from "react-router-dom";
import BodyPage from "./features/body/BodyPage";
import {
  BookOpen,
  BarChart3,
  Dumbbell,
  ListChecks,
  UserRound,
} from "lucide-react";

import ExercisesPage from "./features/exercises/ExercisesPage";
import DiaryPage from "./features/diary/DiaryPage";
import TrainingPage from "./features/training/TrainingPage";
import StatisticsPage from "./features/statistics/StatisticsPage";

export default function App() {
  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <Dumbbell size={22} />
        </div>

        <div>
          <h1>Boulder Tracker</h1>
          <p>Training, einzelne Boulder, Körperdaten und Statistik</p>
        </div>
      </header>

      <main className="main">
        <Routes>
          <Route path="/" element={<DiaryPage />} />
          <Route path="/training" element={<TrainingPage />} />
          <Route path="/exercises" element={<ExercisesPage />} />
          <Route path="/body" element={<BodyPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavItem to="/" icon={<BookOpen size={18} />} label="Tagebuch" />
        <NavItem
          to="/training"
          icon={<ListChecks size={18} />}
          label="Training"
        />
        <NavItem
          to="/exercises"
          icon={<Dumbbell size={18} />}
          label="Übungen"
        />
        <NavItem to="/body" icon={<UserRound size={18} />} label="Körper" />
        <NavItem
          to="/statistics"
          icon={<BarChart3 size={18} />}
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