import {
  useEffect,
  useState,
} from "react";

import {
  BarChart3,
  BookOpen,
  Dumbbell,
  Settings,
  UserRound,
  X,
} from "lucide-react";

import {
  NavLink,
  Route,
  Routes,
} from "react-router-dom";

import BodyPage from "./features/body/BodyPage";
import DiaryPage from "./features/diary/DiaryPage";
import StatisticsPage from "./features/statistics/StatisticsPage";
import TrainingPage from "./features/training/TrainingPage";

type ViewMode = "standard" | "dos";

const VIEW_MODE_STORAGE_KEY =
  "vertical-progress-view-mode";

function loadInitialViewMode(): ViewMode {
  const storedViewMode = localStorage.getItem(
    VIEW_MODE_STORAGE_KEY
  );

  return storedViewMode === "dos"
    ? "dos"
    : "standard";
}

export default function App() {
  const [viewMode, setViewMode] =
    useState<ViewMode>(
      loadInitialViewMode
    );

  const [
    showSettingsModal,
    setShowSettingsModal,
  ] = useState(false);

  useEffect(() => {
    localStorage.setItem(
      VIEW_MODE_STORAGE_KEY,
      viewMode
    );

    document.documentElement.dataset.viewMode =
      viewMode;

    return () => {
      delete document.documentElement.dataset
        .viewMode;
    };
  }, [viewMode]);

  function selectViewMode(
    nextViewMode: ViewMode
  ) {
    setViewMode(nextViewMode);
  }

  function closeSettings() {
    setShowSettingsModal(false);
  }

  return (
    <div
      className={`app ${
        viewMode === "dos"
          ? "app-dos-view"
          : "app-standard-view"
      }`}
    >
      <header className="header app-main-header">
        <div className="logo">
          <Dumbbell size={24} />
        </div>

        <div className="header-title-block">
          <h1>
            {viewMode === "dos"
              ? "VERTICAL PROGRESS"
              : "Vertical Progress"}
          </h1>

          <p>
            {viewMode === "dos"
              ? "BOULDER // TRAINING // BODY // STATS"
              : "Bouldern, Training, Körperdaten und Statistik."}
          </p>
        </div>

        <button
          type="button"
          className="header-settings-button"
          onClick={() =>
            setShowSettingsModal(true)
          }
          aria-label="Einstellungen öffnen"
          title="Einstellungen"
        >
          <Settings size={21} />
        </button>
      </header>

      <main className="main">
        <Routes>
          <Route
            path="/"
            element={<DiaryPage />}
          />

          <Route
            path="/training"
            element={<TrainingPage />}
          />

          <Route
            path="/body"
            element={<BodyPage />}
          />

          <Route
            path="/statistics"
            element={<StatisticsPage />}
          />
        </Routes>
      </main>

      <nav className="bottom-nav">
        <NavItem
          to="/"
          icon={<BookOpen size={21} />}
          label="Tagebuch"
          dosLabel="LOG"
        />

        <NavItem
          to="/training"
          icon={<Dumbbell size={21} />}
          label="Training"
          dosLabel="TRAIN"
        />

        <NavItem
          to="/body"
          icon={<UserRound size={21} />}
          label="Körper"
          dosLabel="BODY"
        />

        <NavItem
          to="/statistics"
          icon={<BarChart3 size={21} />}
          label="Statistik"
          dosLabel="STATS"
        />
      </nav>

      {showSettingsModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeSettings();
            }
          }}
        >
          <div className="modal-card settings-modal">
            <div className="modal-header">
              <div>
                <h3>
                  {viewMode === "dos"
                    ? "SYSTEM SETTINGS"
                    : "Einstellungen"}
                </h3>

                <p>
                  Ansicht der gesamten App
                  festlegen.
                </p>
              </div>

              <button
                type="button"
                className="settings-close-button"
                onClick={closeSettings}
                aria-label="Einstellungen schließen"
              >
                <X size={20} />
              </button>
            </div>

            <div className="settings-section">
              <h4>
                {viewMode === "dos"
                  ? "DISPLAY MODE"
                  : "Ansicht"}
              </h4>

              <div className="view-mode-options">
                <button
                  type="button"
                  className={`view-mode-option ${
                    viewMode === "standard"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectViewMode(
                      "standard"
                    )
                  }
                >
                  <span className="view-mode-marker">
                    {viewMode === "standard"
                      ? "●"
                      : "○"}
                  </span>

                  <span className="view-mode-description">
                    <strong>
                      Standard
                    </strong>

                    <small>
                      Karten, abgerundete
                      Elemente und die
                      bestehende Darstellung.
                    </small>
                  </span>
                </button>

                <button
                  type="button"
                  className={`view-mode-option ${
                    viewMode === "dos"
                      ? "selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectViewMode("dos")
                  }
                >
                  <span className="view-mode-marker">
                    {viewMode === "dos"
                      ? "●"
                      : "○"}
                  </span>

                  <span className="view-mode-description">
                    <strong>
                      DOS View
                    </strong>

                    <small>
                      Monospace, reduzierte
                      Flächen und
                      Terminal-Darstellung.
                      Alle Funktionen und
                      Graphen bleiben
                      erhalten.
                    </small>
                  </span>
                </button>
              </div>
            </div>

            <div className="settings-current-mode">
              <span>
                {viewMode === "dos"
                  ? "CURRENT_MODE"
                  : "Aktuelle Ansicht"}
              </span>

              <strong>
                {viewMode === "dos"
                  ? "DOS"
                  : "Standard"}
              </strong>
            </div>

            <button
              type="button"
              onClick={closeSettings}
            >
              {viewMode === "dos"
                ? "[ SAVE_AND_CLOSE ]"
                : "Übernehmen und schließen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  dosLabel,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  dosLabel: string;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `nav-item ${
          isActive ? "active" : ""
        }`
      }
    >
      {icon}

      <span className="standard-nav-label">
        {label}
      </span>

      <span className="dos-nav-label">
        {dosLabel}
      </span>
    </NavLink>
  );
}