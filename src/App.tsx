import { useEffect, useRef, useState } from "react";
import {
  castVote,
  createRoom,
  type GameClue,
  type GameResult,
  type GameRole,
  type GameSession,
  type GameSettings,
  type Player,
  type Room,
  getGameResult,
  getMyRole,
  joinRoom,
  leaveRoom,
  loadRoom,
  setReady,
  skipExpiredClue,
  startGame,
  submitClue,
  submitFinalGuess,
  updateRoomSettings,
} from "./lib/gameApi";
import { getSupabaseClient } from "./lib/supabase";

type IconName =
  | "arrow"
  | "bolt"
  | "check"
  | "chevron"
  | "clock"
  | "crown"
  | "edit"
  | "download"
  | "globe"
  | "lock"
  | "minus"
  | "plus"
  | "profile"
  | "spark"
  | "users"
  | "x";

const icons: Record<IconName, React.ReactNode> = {
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  bolt: <path d="m13 2-9 12h7l-1 8 9-12h-7l1-8Z" />,
  check: <path d="m5 12 4 4L19 6" />,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  crown: <path d="m3 7 4 3 5-6 5 6 4-3-2 11H5L3 7Z" />,
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5" />
      <path d="M5 17v3h14v-3" />
    </>
  ),
  edit: (
    <>
      <path d="m4 20 4.2-1L19 8.2 15.8 5 5 15.8 4 20Z" />
      <path d="m13.8 7 3.2 3.2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.3 3 14.7 0 18M12 3c-3 3.3-3 14.7 0 18" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="3" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  minus: <path d="M5 12h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  profile: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c.6-4.2 3.3-6 8-6s7.4 1.8 8 6" />
    </>
  ),
  spark: (
    <path d="M12 2c.6 5.7 2.3 7.4 8 8-5.7.6-7.4 2.3-8 8-.6-5.7-2.3-7.4-8-8 5.7-.6 7.4-2.3 8-8Z" />
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M19 8a4 4 0 0 1 0 7M22 21v-2a4 4 0 0 0-3-3.9" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {icons[name]}
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="logo" aria-label="Imposter">
      <span className="logo-mark">
        <span />
      </span>
      {!compact && <span>IMPOSTER</span>}
    </div>
  );
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __imposterDeferredInstallPrompt: InstallPromptEvent | null;
  }
}

function PwaInstallButton() {
  const [installed, setInstalled] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installNotice, setInstallNotice] = useState<"unavailable" | "error" | null>(null);
  const installAttemptInProgress = useRef(false);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const updateInstalled = () =>
      setInstalled(
        standaloneQuery.matches || ("standalone" in navigator && navigator.standalone === true),
      );
    const handleInstallAvailable = () => {
      if (window.__imposterDeferredInstallPrompt) setInstallNotice(null);
    };
    const handleInstalled = () => {
      setInstalled(true);
      window.__imposterDeferredInstallPrompt = null;
      setInstallNotice(null);
    };

    updateInstalled();
    handleInstallAvailable();
    window.addEventListener("imposterinstallpromptavailable", handleInstallAvailable);
    window.addEventListener("appinstalled", handleInstalled);
    standaloneQuery.addEventListener("change", updateInstalled);
    return () => {
      window.removeEventListener("imposterinstallpromptavailable", handleInstallAvailable);
      window.removeEventListener("appinstalled", handleInstalled);
      standaloneQuery.removeEventListener("change", updateInstalled);
    };
  }, []);

  async function handleInstall() {
    if (installAttemptInProgress.current) return;

    const prompt = window.__imposterDeferredInstallPrompt;
    if (!prompt) {
      setInstallNotice("unavailable");
      return;
    }

    installAttemptInProgress.current = true;
    window.__imposterDeferredInstallPrompt = null;
    setInstalling(true);

    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
    } catch (error) {
      console.error("The native PWA install prompt failed.", error);
      setInstallNotice("error");
    } finally {
      installAttemptInProgress.current = false;
      setInstalling(false);
    }
  }

  const userAgent = navigator.userAgent;
  const isAppleMobile =
    /iPhone|iPad|iPod/.test(userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(userAgent);
  const isEdge = /Edg/i.test(userAgent);
  const isChrome = /Chrome|CriOS/i.test(userAgent) && !isEdge;
  const isSafari =
    /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg|Firefox|FxiOS/i.test(userAgent);
  const installInstructions = isAppleMobile
    ? "On iPhone or iPad, use Share → Add to Home Screen."
    : isAndroid
      ? isEdge
        ? "In Microsoft Edge for Android, open ⋯ and choose Install."
        : isChrome
          ? "In Chrome for Android, open ⋮ and choose Install app or Add to Home screen."
          : "Open your browser menu and look for Install app or Add to Home Screen."
      : isEdge
        ? "In Microsoft Edge, select the install icon in the address bar, or open ⋯ → Apps → Install this site as an app."
        : isChrome
          ? "In Google Chrome, select Install IMPOSTER in the address bar or open ⋮ and choose Install IMPOSTER."
          : isSafari
            ? "In Safari on macOS Sonoma or later, choose File → Add to Dock."
            : "Open your browser menu and look for Install app or Add to Home Screen.";

  return (
    <>
      {installed ? (
        <span className="install-complete" role="status">
          <Icon name="check" size={16} />
          <span>Installed</span>
        </span>
      ) : (
        <button
          className="install-button"
          aria-label="Install app"
          disabled={installing}
          onClick={() => void handleInstall()}
        >
          <Icon name="download" size={16} />
          <span>{installing ? "Opening..." : "Install app"}</span>
        </button>
      )}
      {installNotice && (
        <div className="modal-backdrop" onMouseDown={() => setInstallNotice(null)}>
          <section
            className="join-modal install-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="close-button"
              onClick={() => setInstallNotice(null)}
              aria-label="Close install message"
            >
              <Icon name="x" />
            </button>
            <div className="install-promo">
              <span className="install-app-icon">
                <span className="logo-mark">
                  <span />
                </span>
              </span>
              <div>
                <span className="kicker">
                  {installNotice === "error" ? "INSTALL PROMPT ERROR" : "INSTALL FROM BROWSER"}
                </span>
                <h2 id="install-title">
                  {installNotice === "error" ? "PROMPT FAILED" : "CONTINUE IN YOUR BROWSER"}
                </h2>
                <p>
                  {installNotice === "error"
                    ? "Your browser couldn't open the installation prompt. Please try again."
                    : installInstructions}
                </p>
              </div>
            </div>
            <button
              className="secondary-button install-dismiss"
              onClick={() => setInstallNotice(null)}
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}

const categories = [
  { name: "Mix it up", sub: "All categories", icon: "✦", key: "all" },
  { name: "Pop culture", sub: "Movies, music & fame", icon: "◐", key: "pop-culture" },
  { name: "Around the world", sub: "Places & landmarks", icon: "⌖", key: "world" },
  { name: "Food & drink", sub: "For the hungry", icon: "◇", key: "food" },
];

function savedName() {
  return localStorage.getItem("imposter-player-name") ?? "";
}

function saveName(name: string) {
  const cleaned = name.trim().slice(0, 24);
  localStorage.setItem("imposter-player-name", cleaned);
  return cleaned;
}

function Home({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: (code: string, name: string) => Promise<void>;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState(savedName);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setError("");
    setJoining(true);
    try {
      await onJoin(code, name);
      setJoinOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not join this game.");
    } finally {
      setJoining(false);
    }
  }

  return (
    <div className="app-shell home-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar">
        <Logo />
        <div className="header-actions">
          <PwaInstallButton />
          <button className="avatar-button" aria-label="Player profile">
            <span className="online-dot" />
            <span>{name.trim().slice(0, 2).toUpperCase() || "AX"}</span>
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="eyebrow">
            <Icon name="spark" size={14} /> The ultimate bluffing game
          </div>
          <h1>
            Trust your friends.
            <br />
            <em>Or don&apos;t.</em>
          </h1>
          <p>
            One word. One imposter. Zero trust. Get your crew together and find the fake before they
            fool you all.
          </p>
          <div className="hero-visual" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="player-chip chip-one">
              <span className="face face-blue">M</span>
            </div>
            <div className="player-chip chip-two">
              <span className="face face-orange">J</span>
            </div>
            <div className="player-chip chip-three">
              <span className="face face-purple">S</span>
            </div>
            <div className="secret-card">
              <span className="card-label">Your secret word</span>
              <strong>DISCO BALL</strong>
              <span className="category-tag">Nightlife</span>
            </div>
            <div className="imposter-card">
              <span>?</span>
              <b>IMPOSTER</b>
            </div>
          </div>
          <div className="main-actions">
            <button className="primary-button" onClick={onCreate}>
              <span className="play-icon">▶</span>Play now
              <Icon name="arrow" />
            </button>
            <div className="secondary-actions">
              <button className="secondary-button" onClick={onCreate}>
                <Icon name="plus" /> Create game
              </button>
              <button
                className="secondary-button"
                onClick={() => {
                  setError("");
                  setJoinOpen(true);
                }}
              >
                <Icon name="users" /> Join game
              </button>
            </div>
          </div>
          <div className="social-proof">
            <div className="mini-faces">
              <i>V</i>
              <i>K</i>
              <i>R</i>
              <i>N</i>
            </div>
            <span>Get your crew together and start a game</span>
          </div>
        </section>
        <section className="content-section">
          <div className="section-title">
            <div>
              <span className="kicker">Pick your poison</span>
              <h2>Game modes</h2>
            </div>
            <button>
              View all <Icon name="chevron" size={16} />
            </button>
          </div>
          <div className="mode-grid">
            <button className="mode-card featured" onClick={onCreate}>
              <span className="mode-icon">
                <Icon name="bolt" />
              </span>
              <span className="mode-copy">
                <b>Classic</b>
                <small>One word. Find the fake.</small>
              </span>
              <span className="mode-meta">
                <i>3–20</i>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="mode-card" disabled>
              <span className="mode-icon purple">
                <Icon name="clock" />
              </span>
              <span className="mode-copy">
                <b>Rapid fire</b>
                <small>Think fast. Talk faster.</small>
              </span>
              <span className="mode-meta">
                <i>5 min</i>
                <Icon name="lock" size={17} />
              </span>
            </button>
            <button className="mode-card" disabled>
              <span className="mode-icon dark">
                <Icon name="globe" />
              </span>
              <span className="mode-copy">
                <b>World tour</b>
                <small>Global places & culture.</small>
              </span>
              <span className="mode-meta">
                <i>New</i>
                <Icon name="chevron" />
              </span>
            </button>
          </div>
        </section>
        <section className="how-section">
          <span className="kicker">No lengthy rulebook</span>
          <h2>How it goes down</h2>
          <div className="steps">
            <article>
              <span className="step-number">01</span>
              <div className="step-art cards-art">
                <i />
                <i />
                <i />
              </div>
              <h3>Get your role</h3>
              <p>Everyone sees the word — except the imposter.</p>
            </article>
            <article>
              <span className="step-number">02</span>
              <div className="step-art chat-art">
                <i>“Sparkly”</i>
                <i>“Late night”</i>
              </div>
              <h3>Give a clue</h3>
              <p>Say enough to prove you know it, but not enough to reveal it.</p>
            </article>
            <article>
              <span className="step-number">03</span>
              <div className="step-art vote-art">
                <i>3</i>
                <i>1</i>
              </div>
              <h3>Vote them out</h3>
              <p>Read the room, call the bluff, and expose the fake among you.</p>
            </article>
          </div>
        </section>
      </main>
      <footer>
        <Logo />
        <p>Keep your friends close. Keep the imposter closer.</p>
        <span>© 2025 IMPOSTER</span>
      </footer>
      {joinOpen && (
        <div className="modal-backdrop" onMouseDown={() => setJoinOpen(false)}>
          <div className="join-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setJoinOpen(false)}>
              <Icon name="x" />
            </button>
            <span className="modal-symbol">
              <Icon name="users" size={28} />
            </span>
            <span className="kicker">Your crew is waiting</span>
            <h2>Join a game</h2>
            <p>Enter your name and the 6-character code from your host.</p>
            <input
              className="name-input"
              maxLength={24}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your name"
              aria-label="Your name"
            />
            <input
              maxLength={6}
              value={code}
              onChange={(event) =>
                setCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
              }
              placeholder="ABC123"
              autoFocus
              aria-label="Game code"
            />
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary-button"
              disabled={joining || code.length !== 6 || !name.trim()}
              onClick={() => void handleJoin()}
            >
              {joining ? "Joining…" : "Enter game"} <Icon name="arrow" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Counter({
  value,
  setValue,
  min,
  max,
}: {
  value: number;
  setValue: (value: number) => void;
  min: number;
  max: number;
}) {
  return (
    <div className="counter">
      <button onClick={() => setValue(Math.max(min, value - 1))} disabled={value === min}>
        <Icon name="minus" />
      </button>
      <b>{value}</b>
      <button onClick={() => setValue(Math.min(max, value + 1))} disabled={value === max}>
        <Icon name="plus" />
      </button>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      className={`toggle ${checked ? "active" : ""}`}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

const defaultSettings: GameSettings = {
  maxPlayers: 8,
  imposters: 1,
  category: "all",
  difficulty: "Easy",
  clueTimer: 60,
  imposterHint: "category",
  finalGuess: true,
  customRules: "",
};

function CreateGame({
  initialSettings,
  roomExists,
  onBack,
  onCreate,
}: {
  initialSettings: GameSettings;
  roomExists: boolean;
  onBack: () => void;
  onCreate: (settings: GameSettings, name: string) => Promise<void>;
}) {
  const [imposters, setImposters] = useState(initialSettings.imposters);
  const [players, setPlayers] = useState(initialSettings.maxPlayers);
  const [category, setCategory] = useState(initialSettings.category);
  const [difficulty, setDifficulty] = useState(initialSettings.difficulty);
  const [timer, setTimer] = useState(initialSettings.clueTimer);
  const [hint, setHint] = useState(initialSettings.imposterHint);
  const [finalGuess, setFinalGuess] = useState(initialSettings.finalGuess);
  const [customRules, setCustomRules] = useState(Boolean(initialSettings.customRules));
  const [rulesText, setRulesText] = useState(initialSettings.customRules);
  const [name, setName] = useState(savedName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const settings: GameSettings = {
    maxPlayers: players,
    imposters,
    category,
    difficulty,
    clueTimer: timer,
    imposterHint: hint,
    finalGuess,
    customRules: customRules ? rulesText : "",
  };

  async function save() {
    setError("");
    setSaving(true);
    try {
      await onCreate(settings, name);
      saveName(name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save this game.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="app-shell create-page">
      <div className="ambient ambient-one" />
      <header className="create-header">
        <button onClick={onBack} className="back-button" aria-label="Go back">
          ‹
        </button>
        <Logo />
        <div className="header-actions">
          <PwaInstallButton />
          <button className="icon-button" aria-label="Profile">
            <Icon name="profile" />
          </button>
        </div>
      </header>
      <main className="create-main">
        <div className="create-intro">
          <span className="eyebrow">
            <Icon name="spark" size={14} /> Your game, your rules
          </span>
          <h1>Set the stage.</h1>
          <p>Fine-tune the chaos before your crew joins.</p>
        </div>
        <div className="settings-layout">
          <div className="settings-column">
            <section className="settings-card">
              <div className="setting-row">
                <div className="setting-icon lime">
                  <Icon name="users" />
                </div>
                <div className="setting-copy">
                  <b>Imposters</b>
                  <small>More fakes, more chaos</small>
                </div>
                <Counter
                  value={imposters}
                  setValue={setImposters}
                  min={1}
                  max={Math.min(3, players - 1)}
                />
              </div>
              <div className="setting-row">
                <div className="setting-icon purple">
                  <Icon name="profile" />
                </div>
                <div className="setting-copy">
                  <b>Player limit</b>
                  <small>How big is the crew?</small>
                </div>
                <Counter
                  value={players}
                  setValue={(value) => {
                    setPlayers(value);
                    setImposters(Math.min(imposters, value - 1));
                  }}
                  min={3}
                  max={20}
                />
              </div>
            </section>
            <section className="setting-section">
              <div className="section-label">
                <span>Choose a category</span>
                <small>{categories.length} packs</small>
              </div>
              <div className="category-grid">
                {categories.map((item) => (
                  <button
                    key={item.key}
                    className={category === item.key ? "selected" : ""}
                    onClick={() => setCategory(item.key)}
                  >
                    <i>{item.icon}</i>
                    <span>
                      <b>{item.name}</b>
                      <small>{item.sub}</small>
                    </span>
                    {category === item.key && (
                      <em>
                        <Icon name="check" size={14} />
                      </em>
                    )}
                  </button>
                ))}
              </div>
            </section>
            <section className="setting-section">
              <div className="section-label">
                <span>Difficulty</span>
              </div>
              <div className="segmented">
                {["Easy", "Sneaky", "Brutal"].map((item) => (
                  <button
                    key={item}
                    className={difficulty === item ? "active" : ""}
                    onClick={() => setDifficulty(item)}
                  >
                    {item}
                    {item === "Sneaky" && <small>Popular</small>}
                  </button>
                ))}
              </div>
            </section>
          </div>
          <div className="settings-column">
            <section className="settings-card compact-card">
              <div className="setting-row timer-row">
                <div className="setting-icon orange">
                  <Icon name="clock" />
                </div>
                <div className="setting-copy">
                  <b>Clue timer</b>
                  <small>Time per player</small>
                </div>
                <strong>
                  {timer}
                  <small> sec</small>
                </strong>
              </div>
              <input
                className="range"
                type="range"
                min="30"
                max="120"
                step="15"
                value={timer}
                onChange={(event) => setTimer(Number(event.target.value))}
                style={{ "--progress": `${((timer - 30) / 90) * 100}%` } as React.CSSProperties}
              />
              <div className="range-labels">
                <span>30s</span>
                <span>2 min</span>
              </div>
            </section>
            <section className="setting-section">
              <div className="section-label">
                <span>Imposter hint</span>
              </div>
              <div className="choice-cards">
                {(["category", "none"] as const).map((value) => (
                  <button
                    key={value}
                    className={hint === value ? "selected" : ""}
                    onClick={() => setHint(value)}
                  >
                    <span className="radio">
                      <i />
                    </span>
                    <span>
                      <b>{value === "category" ? "Category only" : "No hint"}</b>
                      <small>
                        {value === "category"
                          ? "A little help blending in"
                          : "Pure chaos. Good luck."}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
            <section className="settings-card options-card">
              <div className="setting-row">
                <div className="setting-copy">
                  <b>Final guess</b>
                  <small>Imposter can steal the win</small>
                </div>
                <Toggle checked={finalGuess} onChange={() => setFinalGuess(!finalGuess)} />
              </div>
              <div className="setting-row">
                <div className="setting-copy">
                  <b>Custom rules</b>
                  <small>Add your own house rules</small>
                </div>
                <Toggle checked={customRules} onChange={() => setCustomRules(!customRules)} />
              </div>
              {customRules && (
                <textarea
                  value={rulesText}
                  onChange={(event) => setRulesText(event.target.value)}
                  placeholder="Example: Clues can only be one word..."
                  maxLength={140}
                />
              )}
            </section>
          </div>
        </div>
        <div className="setup-summary">
          <div>
            <span>
              <Icon name="users" size={17} /> Up to {players}
            </span>
            <span>
              <Icon name="bolt" size={17} /> {imposters} imposter{imposters > 1 ? "s" : ""}
            </span>
            <span>
              <Icon name="clock" size={17} /> {timer}s turns
            </span>
          </div>
          <div className="create-submit">
            {!roomExists && (
              <input
                className="name-input"
                maxLength={24}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                aria-label="Your name"
              />
            )}
            <button
              className="primary-button"
              disabled={saving || (!roomExists && !name.trim())}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : roomExists ? "Save lobby settings" : "Create lobby"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

function Lobby({
  room,
  players,
  userId,
  onlineIds,
  onBack,
  onReady,
  onStart,
  onEdit,
  error,
  busy,
}: {
  room: Room;
  players: Player[];
  userId: string;
  onlineIds: Set<string>;
  onBack: () => void;
  onReady: (ready: boolean) => void;
  onStart: () => void;
  onEdit: () => void;
  error: string;
  busy: boolean;
}) {
  const isHost = room.host_id === userId;
  const currentPlayer = players.find((player) => player.id === userId);
  const allReady = players.length >= 3 && players.every((player) => player.is_ready);
  const [copyError, setCopyError] = useState("");

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(room.code);
      setCopyError("Game code copied.");
    } catch {
      setCopyError("Copy was blocked by your browser. Share this code: " + room.code);
    }
  }

  return (
    <div className="app-shell create-page lobby-page">
      <div className="ambient ambient-one" />
      <header className="create-header">
        <button onClick={onBack} className="back-button" aria-label="Leave lobby">
          ‹
        </button>
        <Logo />
        <div className="header-actions">
          <PwaInstallButton />
          <button
            className="icon-button"
            aria-label="Edit game settings"
            onClick={onEdit}
            disabled={!isHost}
          >
            <Icon name="edit" />
          </button>
        </div>
      </header>
      <main className="lobby">
        <span className="lobby-status">
          <i /> Lobby is live
        </span>
        <p className="kicker">Game code</p>
        <h1>{room.code}</h1>
        <button className="copy-code" onClick={() => void copyCode()}>
          Tap to copy code
        </button>
        {copyError && (
          <p className="lobby-message" role="status">
            {copyError}
          </p>
        )}
        <div className="lobby-card">
          <div className="lobby-card-head">
            <h2>Players</h2>
            <span>
              {players.length} / {room.settings.maxPlayers}
            </span>
          </div>
          <div className="player-list">
            {players.map((player, index) => (
              <div key={player.id}>
                <i
                  className={`face ${["face-blue", "face-orange", "face-purple", "face-green"][index % 4]}`}
                >
                  {player.display_name.slice(0, 1).toUpperCase()}
                </i>
                <span>
                  <b>
                    {player.display_name}
                    {player.id === userId ? " (you)" : ""}
                  </b>
                  <small>
                    {player.id === room.host_id ? "Host" : player.is_ready ? "Ready" : "Not ready"}
                  </small>
                </span>
                {player.id === room.host_id ? (
                  <Icon name="crown" />
                ) : (
                  <i
                    className={`ready-dot ${onlineIds.has(player.id) ? "" : "offline"}`}
                    title={onlineIds.has(player.id) ? "Online" : "Offline"}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="lobby-settings">
          <span>
            {room.settings.imposters} imposter{room.settings.imposters > 1 ? "s" : ""}
          </span>
          <span>
            {categories.find((item) => item.key === room.settings.category)?.name ?? "Mix it up"}
          </span>
          <span>{room.settings.difficulty}</span>
          <span>{room.settings.clueTimer}s clue timer</span>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {isHost ? (
          <button
            className="primary-button lobby-start"
            disabled={busy || !allReady}
            onClick={onStart}
          >
            {busy
              ? "Starting…"
              : allReady
                ? "Start game"
                : players.length < 3
                  ? "Need at least 3 players"
                  : "Waiting for players"}
            <span>{players.length} players</span>
            <Icon name="arrow" />
          </button>
        ) : (
          <button
            className="primary-button lobby-start"
            disabled={busy || !currentPlayer}
            onClick={() => onReady(!currentPlayer?.is_ready)}
          >
            {currentPlayer?.is_ready ? "You’re ready" : "Ready up"}
            <Icon name="check" />
          </button>
        )}
        <button className="text-button" onClick={onBack}>
          Leave lobby
        </button>
      </main>
    </div>
  );
}

function GameScreen({
  room,
  players,
  game,
  clues,
  hasVoted,
  userId,
  onClue,
  onSkipExpired,
  onVote,
  onGuess,
  onBack,
  error,
  busy,
}: {
  room: Room;
  players: Player[];
  game: GameSession;
  clues: GameClue[];
  hasVoted: boolean;
  userId: string;
  onClue: (clue: string) => void;
  onSkipExpired: () => void;
  onVote: (playerId: string) => Promise<boolean>;
  onGuess: (guess: string) => void;
  onBack: () => void;
  error: string;
  busy: boolean;
}) {
  const [role, setRole] = useState<GameRole | null>(null);
  const [roleError, setRoleError] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [clue, setClue] = useState("");
  const [guess, setGuess] = useState("");
  const [voted, setVoted] = useState(false);
  const [result, setResult] = useState<GameResult | null>(null);
  const [loadingResult, setLoadingResult] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const myPlayer = players.find((player) => player.id === userId);
  const currentPlayer = players.find((player) => player.id === game.current_turn_player_id);
  const currentClues = clues.filter((entry) => entry.round_number === game.round_number);

  useEffect(() => {
    setVoted(hasVoted);
  }, [game.phase, hasVoted]);

  useEffect(() => {
    const deadline = game.turn_deadline;
    if (game.phase !== "clue" || !deadline) return;
    let skipRequested = false;
    const updateCountdown = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(deadline) - Date.now()) / 1000));
      setSecondsRemaining(remaining);
      if (remaining === 0 && !skipRequested) {
        skipRequested = true;
        onSkipExpired();
      }
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(intervalId);
  }, [game.phase, game.turn_deadline, room.id]);

  useEffect(() => {
    let active = true;
    void getMyRole(room.id)
      .then((value) => {
        if (active) setRole(value);
      })
      .catch((cause: unknown) => {
        if (active)
          setRoleError(cause instanceof Error ? cause.message : "Could not load your role.");
      });
    return () => {
      active = false;
    };
  }, [room.id]);

  useEffect(() => {
    if (game.phase !== "result") return;
    let active = true;
    setLoadingResult(true);
    void getGameResult(room.id)
      .then((value) => {
        if (active) setResult(value);
      })
      .catch((cause: unknown) => {
        if (active)
          setRoleError(cause instanceof Error ? cause.message : "Could not load the game result.");
      })
      .finally(() => {
        if (active) setLoadingResult(false);
      });
    return () => {
      active = false;
    };
  }, [room.id, game.phase]);

  function playerName(id: string | null) {
    return players.find((player) => player.id === id)?.display_name ?? "A player";
  }

  return (
    <div className="app-shell create-page lobby-page">
      <div className="ambient ambient-one" />
      <header className="create-header">
        <button onClick={onBack} className="back-button" aria-label="Leave game">
          ‹
        </button>
        <Logo />
        <div className="header-actions">
          <PwaInstallButton />
          <span className="game-round">
            Round {game.round_number} · {room.code}
          </span>
        </div>
      </header>
      <main className="lobby game-main">
        <span className="lobby-status">
          <i /> Game in progress
        </span>
        <p className="kicker">
          {game.phase === "clue"
            ? "Clue round"
            : game.phase === "vote"
              ? "Time to vote"
              : game.phase === "final_guess"
                ? "Final guess"
                : "Game over"}
        </p>
        <h1 className="game-heading">
          {game.phase === "clue"
            ? "Stay subtle."
            : game.phase === "vote"
              ? "Who’s the imposter?"
              : game.phase === "final_guess"
                ? "One last chance."
                : "The truth is out."}
        </h1>
        {game.phase !== "result" && (
          <button
            className={`role-card ${role?.is_imposter ? "imposter-role" : ""}`}
            onClick={() => setRevealed(!revealed)}
            aria-label={revealed ? "Hide your secret role" : "Reveal your secret role"}
          >
            {revealed && role ? (
              <>
                <small>Your secret role</small>
                <strong>{role.is_imposter ? "IMPOSTER" : role.word}</strong>
                <span>
                  {role.is_imposter
                    ? role.category_hint
                      ? `Hint: ${role.category_hint}`
                      : "No hint — bluff your way through."
                    : "You’re a civilian. Find the imposter."}
                </span>
              </>
            ) : (
              <>
                <small>Only you can see this</small>
                <strong>Tap to reveal your role</strong>
                <span>Keep your screen private.</span>
              </>
            )}
          </button>
        )}
        {game.phase === "clue" && (
          <section className="game-panel">
            {room.settings.customRules && (
              <p className="lobby-message">House rule: {room.settings.customRules}</p>
            )}
            <p>
              {myPlayer?.is_eliminated
                ? "You were voted out. Watch the remaining players finish the game."
                : currentPlayer?.id === userId
                  ? "It’s your turn. Give a clue that does not reveal the word."
                  : `${playerName(game.current_turn_player_id)} is giving a clue.`}
            </p>
            {currentClues.map((entry) => (
              <div className="clue-row" key={entry.id}>
                <b>{playerName(entry.player_id)}</b>
                <span>{entry.clue}</span>
              </div>
            ))}
            {!myPlayer?.is_eliminated &&
              game.current_turn_player_id === userId &&
              !currentClues.some((entry) => entry.player_id === userId) && (
                <div className="game-action">
                  <input
                    value={clue}
                    maxLength={80}
                    onChange={(event) => setClue(event.target.value)}
                    placeholder="Your clue (max 80 characters)"
                  />
                  <button
                    className="primary-button"
                    disabled={busy || !clue.trim()}
                    onClick={() => onClue(clue)}
                  >
                    Send clue <Icon name="arrow" />
                  </button>
                </div>
              )}
            <small>{secondsRemaining} seconds remaining in this turn</small>
          </section>
        )}
        {game.phase === "vote" && (
          <section className="game-panel">
            {room.settings.customRules && (
              <p className="lobby-message">House rule: {room.settings.customRules}</p>
            )}
            <p>
              Discuss your clues, then each player votes once. Your vote is private until everyone
              has voted.
            </p>
            {currentClues.map((entry) => (
              <div className="clue-row" key={entry.id}>
                <b>{playerName(entry.player_id)}</b>
                <span>{entry.clue}</span>
              </div>
            ))}{" "}
            {myPlayer?.is_eliminated ? (
              <p className="lobby-message">You were voted out. Wait for the remaining players.</p>
            ) : voted ? (
              <p className="lobby-message">Vote submitted. Waiting for the other players…</p>
            ) : (
              <div className="vote-list">
                {players
                  .filter((player) => player.id !== userId && !player.is_eliminated)
                  .map((player) => (
                    <button
                      key={player.id}
                      disabled={busy}
                      onClick={() => {
                        void onVote(player.id).then((success) => {
                          if (success) setVoted(true);
                        });
                      }}
                    >
                      <span>{player.display_name}</span>
                      <Icon name="chevron" />
                    </button>
                  ))}
              </div>
            )}
          </section>
        )}
        {game.phase === "final_guess" && (
          <section className="game-panel">
            <p>
              {game.eliminated_player_id === userId
                ? "You were identified as an imposter. Guess the secret word to steal the win."
                : `${playerName(game.eliminated_player_id)} has one chance to guess the word.`}
            </p>
            {game.eliminated_player_id === userId && (
              <div className="game-action">
                <input
                  value={guess}
                  onChange={(event) => setGuess(event.target.value)}
                  placeholder="What is the secret word?"
                />
                <button
                  className="primary-button"
                  disabled={busy || !guess.trim()}
                  onClick={() => onGuess(guess)}
                >
                  Lock in guess <Icon name="arrow" />
                </button>
              </div>
            )}
          </section>
        )}
        {game.phase === "result" &&
          (loadingResult ? (
            <p>Revealing the result…</p>
          ) : (
            result && (
              <section className="game-panel result-panel">
                <span className="result-mark">
                  <Icon name={result.winner === "civilians" ? "check" : "bolt"} />
                </span>
                <h2>{result.winner === "civilians" ? "Civilians win!" : "Imposters win!"}</h2>
                <p>
                  The secret word was <b>{result.word}</b>.
                </p>
                <div className="vote-list">
                  {result.players.map((player) => (
                    <div className="clue-row" key={player.player_id}>
                      <b>
                        {playerName(player.player_id)}
                        {player.is_imposter ? " · Imposter" : ""}
                      </b>
                      <span>
                        {player.vote_count} vote{player.vote_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )
          ))}
        {(error || roleError) && (
          <p className="form-error" role="alert">
            {error || roleError}
          </p>
        )}
        {game.phase === "result" && (
          <button className="text-button" onClick={onBack}>
            Leave game
          </button>
        )}
        {myPlayer && <p className="game-player-note">Playing as {myPlayer.display_name}</p>}
      </main>
    </div>
  );
}

type Snapshot = Awaited<ReturnType<typeof loadRoom>>;

export default function App() {
  const [screen, setScreen] = useState<"home" | "create" | "room">("home");
  const [roomId, setRoomId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    if (!roomId || screen !== "room") return;
    let disposed = false;
    let channel: ReturnType<ReturnType<typeof getSupabaseClient>["channel"]> | undefined;

    async function connect() {
      try {
        const data = await loadRoom(roomId);
        if (disposed) return;
        setSnapshot(data);
        const supabase = getSupabaseClient();
        const refresh = () => {
          void loadRoom(roomId)
            .then((next) => {
              if (!disposed) setSnapshot(next);
            })
            .catch((cause: unknown) => {
              if (!disposed)
                setError(cause instanceof Error ? cause.message : "Could not refresh the game.");
            });
        };
        channel = supabase
          .channel(`room:${roomId}`, { config: { presence: { key: data.userId } } })
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomId}` },
            refresh,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomId}` },
            refresh,
          )
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: "game_sessions",
              filter: `room_id=eq.${roomId}`,
            },
            refresh,
          )
          .on(
            "postgres_changes",
            { event: "*", schema: "public", table: "game_clues", filter: `room_id=eq.${roomId}` },
            refresh,
          )
          .on("presence", { event: "sync" }, () => {
            if (channel) setOnlineIds(new Set(Object.keys(channel.presenceState())));
          })
          .subscribe(async (status) => {
            if (status === "SUBSCRIBED") {
              const presenceStatus = await channel?.track({ userId: data.userId });
              if (presenceStatus && presenceStatus !== "ok")
                setError(`Could not publish online status: ${presenceStatus}`);
            } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
              setError(
                `Live updates are unavailable (${status}). Check your Supabase Realtime setup and connection.`,
              );
            }
          });
      } catch (cause) {
        if (!disposed)
          setError(cause instanceof Error ? cause.message : "Could not connect to this game.");
      }
    }

    void connect();
    return () => {
      disposed = true;
      if (channel) void getSupabaseClient().removeChannel(channel);
    };
  }, [roomId, screen]);

  async function enterRoom(response: { room_id: string; code: string }) {
    setRoomId(response.room_id);
    setScreen("room");
    setError("");
  }

  async function handleJoin(code: string, name: string) {
    const response = await joinRoom(code, saveName(name));
    await enterRoom(response);
  }

  async function handleCreate(settingsToSave: GameSettings, name: string) {
    setBusy(true);
    setError("");
    try {
      if (roomId && snapshot) {
        await updateRoomSettings(roomId, settingsToSave);
        setSettings(settingsToSave);
        setScreen("room");
      } else {
        const response = await createRoom(saveName(name), settingsToSave);
        setSettings(settingsToSave);
        await enterRoom(response);
      }
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: () => Promise<void>): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      await action();
      if (roomId) setSnapshot(await loadRoom(roomId));
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The game action failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave() {
    if (!roomId) {
      setScreen("home");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await leaveRoom(roomId);
      setSnapshot(null);
      setRoomId("");
      setOnlineIds(new Set());
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not leave this game.");
    } finally {
      setBusy(false);
    }
  }

  if (screen === "home") return <Home onCreate={() => setScreen("create")} onJoin={handleJoin} />;
  if (screen === "create")
    return (
      <CreateGame
        initialSettings={roomId ? (snapshot?.room.settings ?? settings) : defaultSettings}
        roomExists={Boolean(roomId)}
        onBack={() => setScreen(roomId ? "room" : "home")}
        onCreate={handleCreate}
      />
    );
  if (!snapshot)
    return (
      <div className="app-shell create-page">
        <main className="lobby">
          <p>Connecting to your game…</p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="text-button"
            onClick={() => {
              setRoomId("");
              setScreen("home");
            }}
          >
            Back home
          </button>
        </main>
      </div>
    );

  if (snapshot.game)
    return (
      <GameScreen
        room={snapshot.room}
        players={snapshot.players}
        game={snapshot.game}
        clues={snapshot.clues}
        hasVoted={snapshot.hasVoted}
        userId={snapshot.userId}
        onClue={(clue) => {
          void runAction(() => submitClue(roomId, clue));
        }}
        onSkipExpired={() => {
          void runAction(async () => {
            await skipExpiredClue(roomId);
          });
        }}
        onVote={(playerId) => runAction(() => castVote(roomId, playerId))}
        onGuess={(guess) => {
          void runAction(() => submitFinalGuess(roomId, guess));
        }}
        onBack={() => void handleLeave()}
        error={error}
        busy={busy}
      />
    );

  return (
    <Lobby
      room={snapshot.room}
      players={snapshot.players}
      userId={snapshot.userId}
      onlineIds={onlineIds}
      onBack={() => void handleLeave()}
      onReady={(ready) => {
        void runAction(() => setReady(roomId, ready));
      }}
      onStart={() => {
        void runAction(() => startGame(roomId));
      }}
      onEdit={() => {
        setSettings(snapshot.room.settings);
        setScreen("create");
      }}
      error={error}
      busy={busy}
    />
  );
}
