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
  updateMyIdentity,
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

function ModeArtwork({ mode }: { mode: "classic" | "rapid" | "world" }) {
  if (mode === "classic") {
    return (
      <svg className="mode-artwork" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path
          d="M10.8 13.2 29 9.5a3 3 0 0 1 3.5 2.3l4.7 23a3 3 0 0 1-2.3 3.5l-18.2 3.6a3 3 0 0 1-3.5-2.3l-4.7-23a3 3 0 0 1 2.3-3.4Z"
          fill="#35451D"
          stroke="#91B92D"
          strokeWidth="1.5"
        />
        <path
          d="M18 7.8h16a3.5 3.5 0 0 1 3.5 3.5v25.4a3.5 3.5 0 0 1-3.5 3.5H18a3.5 3.5 0 0 1-3.5-3.5V11.3A3.5 3.5 0 0 1 18 7.8Z"
          fill="url(#classic-card-fill)"
          stroke="#D7FF59"
          strokeWidth="1.5"
        />
        <path d="m19.4 18.6 2.4 1.5 3.1-4 3.1 4 2.4-1.5-1.3 7.1h-8.4l-1.3-7.1Z" fill="#263416" />
        <circle cx="23" cy="31.2" r="1.6" fill="#263416" />
        <circle cx="29" cy="31.2" r="1.6" fill="#263416" />
        <defs>
          <linearGradient id="classic-card-fill" x1="16" y1="8" x2="39" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#C8FA45" />
            <stop offset="1" stopColor="#6D9828" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (mode === "rapid") {
    return (
      <svg className="mode-artwork" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M6 17h5M4 23h6M7 29h4" stroke="#C1A7FF" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M29.5 7.5h-8l-1 4.2a13.5 13.5 0 1 0 10 0l-1-4.2ZM18.5 7.5h14"
          stroke="#D1BEFF"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="25.5" cy="26" r="9.5" fill="url(#rapid-clock-fill)" />
        <path d="M25.5 20.5v6l4 2.5" stroke="#281D45" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m36.5 13 1.2-2.5 1.2 2.5 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6-2.5-1.2 2.5-1.2Z" fill="#E0D3FF" />
        <defs>
          <linearGradient id="rapid-clock-fill" x1="17" y1="16" x2="34" y2="36" gradientUnits="userSpaceOnUse">
            <stop stopColor="#D0B9FF" />
            <stop offset="1" stopColor="#8B63D8" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  return (
    <svg className="mode-artwork" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="23" cy="24" r="15" fill="url(#world-globe-fill)" stroke="#A1D8D0" strokeWidth="1.5" />
      <path d="M8.5 24h29M23 9c4.4 4.1 6.6 9.1 6.6 15S27.4 34.9 23 39M23 9c-4.4 4.1-6.6 9.1-6.6 15S18.6 34.9 23 39" stroke="#17443F" strokeWidth="1.5" />
      <path d="M31.5 18.5a7.5 7.5 0 0 1 7.5 7.5c0 5.2-7.5 11.5-7.5 11.5S24 31.2 24 26a7.5 7.5 0 0 1 7.5-7.5Z" fill="#D6FFF7" stroke="#5CABA0" strokeWidth="1.5" />
      <circle cx="31.5" cy="26" r="2.5" fill="#337B71" />
      <defs>
        <linearGradient id="world-globe-fill" x1="10" y1="10" x2="36" y2="39" gradientUnits="userSpaceOnUse">
          <stop stopColor="#B6E9E0" />
          <stop offset="1" stopColor="#619B91" />
        </linearGradient>
      </defs>
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
    __imposterInstallPromptStatus: "waiting" | "available" | "consumed" | "accepted" | "installed";
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
    console.info("[PWA] Install UI initialized.", {
      displayModeStandalone: standaloneQuery.matches,
      legacyStandalone: "standalone" in navigator && navigator.standalone === true,
      capturedPromptAvailable: Boolean(window.__imposterDeferredInstallPrompt),
      promptStatus: window.__imposterInstallPromptStatus,
    });
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
    console.info("[PWA] Install button clicked.", {
      capturedPromptAvailable: Boolean(prompt),
      promptStatus: window.__imposterInstallPromptStatus,
      secureContext: window.isSecureContext,
      standalone: window.matchMedia("(display-mode: standalone)").matches,
      eligibilityApi: "No standard browser API exposes PWA install eligibility.",
    });
    if (!prompt) {
      console.warn(
        "[PWA] No beforeinstallprompt event has been received in this page session; showing browser-specific fallback. This does not prove the app is ineligible.",
      );
      setInstallNotice("unavailable");
      return;
    }

    installAttemptInProgress.current = true;
    window.__imposterDeferredInstallPrompt = null;
    window.__imposterInstallPromptStatus = "consumed";
    setInstalling(true);

    try {
      console.info("[PWA] Calling the captured native install prompt.");
      await prompt.prompt();
      const choice = await prompt.userChoice;
      console.info(`[PWA] User ${choice.outcome} the native install prompt.`, {
        platform: choice.platform,
      });
      if (choice.outcome === "accepted") {
        window.__imposterInstallPromptStatus = "accepted";
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
      {!installed && (
        <button
          className="install-button"
          aria-label="Install app"
          disabled={installing}
          onClick={() => void handleInstall()}
        >
          <img className="install-button-icon" src="/imposter-192.png" alt="" />
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
                <img src="/imposter-192.png" alt="" />
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

type PlayerIdentity = { nickname: string; avatar: string };

const playerAvatars = [
  { id: "avatar-mask", name: "The Mask", color: "#d8bd4e", face: "mask" },
  { id: "avatar-lime", name: "The Lookout", color: "#c5f442", face: "calm" },
  { id: "avatar-violet", name: "The Phantom", color: "#a477ff", face: "smirk" },
  { id: "avatar-cyan", name: "The Signal", color: "#4ed8e8", face: "robot" },
  { id: "avatar-coral", name: "The Suspect", color: "#ff705e", face: "frown" },
  { id: "avatar-mint", name: "The Insider", color: "#61d9a1", face: "smile" },
  { id: "avatar-gold", name: "The Wildcard", color: "#e5bd52", face: "star" },
];
const legacyPlayerAvatars = ["👀", "🎭", "👻", "🤖", "😈", "😎", "🦊", "🐸"];
const defaultPlayerAvatar = playerAvatars[0].id;
const identityStorageKey = "imposter-player-profile";

function normalizePlayerAvatar(avatar: string): string {
  const legacyAvatarIndex = legacyPlayerAvatars.indexOf(avatar);
  return legacyAvatarIndex >= 0
    ? playerAvatars[Math.min(legacyAvatarIndex, playerAvatars.length - 1)].id
    : avatar;
}

function AvatarIllustration({ avatar }: { avatar: string }) {
  const normalizedAvatar = normalizePlayerAvatar(avatar);
  const preset = playerAvatars.find((item) => item.id === normalizedAvatar);
  if (!preset) return <>{normalizedAvatar || "?"}</>;

  const face = preset.face;
  return (
    <svg className="avatar-illustration" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M9 18.5c0-8.1 6.4-14 15-14s15 5.9 15 14v11c0 8.2-6.2 14-15 14S9 37.7 9 29.5v-11Z" fill="#101310" stroke={preset.color} strokeWidth="1.5" />
      {face === "mask" && <path d="m13 13 3-7 5 5 3-7 4 7 6-4 1 8" stroke={preset.color} strokeWidth="1.4" strokeLinejoin="round" />}
      {face === "star" ? (
        <path d="m24 13 2.4 6.1 6.6.4-5.1 4.2 1.7 6.4-5.6-3.6-5.6 3.6 1.7-6.4-5.1-4.2 6.6-.4L24 13Z" fill={`${preset.color}28`} stroke={preset.color} strokeWidth="1.5" strokeLinejoin="round" />
      ) : (
        <>
          {face === "robot" && <path d="M24 7V4m-2 0h4" stroke={preset.color} strokeWidth="1.5" strokeLinecap="round" />}
          <path d={face === "mask" ? "M14 20.5 22 18l-1 6-7 1.5Zm12 0 8 1.5-7 2-1-6Z" : "M16.5 20.5v.1m15-.1v.1"} stroke={preset.color} strokeWidth={face === "mask" ? "1.5" : "3"} strokeLinecap="round" strokeLinejoin="round" />
          {face === "robot" && <path d="M15 17h18v13H15z" stroke={preset.color} strokeWidth="1.3" />}
          <path
            d={
              face === "smile" ? "M18 29c2 4 10 4 12 0" :
              face === "frown" ? "M18 33c2-4 10-4 12 0" :
              face === "smirk" ? "M19 30c3 2 7 2 11-1" :
              face === "focused" ? "M19 31h10" :
              face === "robot" ? "M20 35h8" :
              "M19 30c2 2 8 2 10 0"
            }
            stroke={preset.color}
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {face === "focused" && <path d="m14 17 5 1m15-1-5 1" stroke={preset.color} strokeWidth="1.3" strokeLinecap="round" />}
        </>
      )}
      <path d="M17 39.5h14" stroke={preset.color} strokeWidth="1.2" strokeLinecap="round" opacity=".55" />
    </svg>
  );
}

function savedIdentity(): PlayerIdentity | null {
  try {
    const stored = localStorage.getItem(identityStorageKey);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<PlayerIdentity>;
      if (typeof parsed.nickname === "string" && typeof parsed.avatar === "string") {
        return { nickname: parsed.nickname, avatar: normalizePlayerAvatar(parsed.avatar) };
      }
    }
    const legacyName = localStorage.getItem("imposter-player-name")?.trim();
    return legacyName ? { nickname: legacyName.slice(0, 24), avatar: defaultPlayerAvatar } : null;
  } catch {
    return null;
  }
}

function saveIdentity(identity: PlayerIdentity) {
  const saved = { nickname: identity.nickname.trim().slice(0, 24), avatar: identity.avatar };
  localStorage.setItem(identityStorageKey, JSON.stringify(saved));
  localStorage.setItem("imposter-player-name", saved.nickname);
  return saved;
}

function PlayerAvatar({ avatar, nickname, className = "" }: {
  avatar?: string | null;
  nickname: string;
  className?: string;
}) {
  const normalizedAvatar = avatar ? normalizePlayerAvatar(avatar) : defaultPlayerAvatar;
  if (normalizedAvatar.startsWith("data:image/")) {
    return <img className={`player-avatar ${className}`} src={normalizedAvatar} alt={`${nickname}'s avatar`} />;
  }
  if (playerAvatars.some((item) => item.id === normalizedAvatar)) {
    return (
      <span className={`player-avatar player-avatar-illustration ${className}`} aria-label={`${nickname}'s avatar`}>
        <AvatarIllustration avatar={normalizedAvatar} />
      </span>
    );
  }
  return (
    <span className={`player-avatar player-avatar-emoji ${className}`} aria-label={`${nickname}'s avatar`}>
      {avatar || defaultPlayerAvatar}
    </span>
  );
}

async function readAvatarFile(file: File): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
    throw new Error("Choose a PNG, JPEG, or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) throw new Error("Choose an image smaller than 5 MB.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Could not read that image."));
    };
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("That image could not be opened."));
    element.src = source;
  });
  const canvas = document.createElement("canvas");
  canvas.width = 192;
  canvas.height = 192;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo uploads are unavailable in this browser.");
  const cropSize = Math.min(image.naturalWidth, image.naturalHeight);
  context.drawImage(
    image,
    (image.naturalWidth - cropSize) / 2,
    (image.naturalHeight - cropSize) / 2,
    cropSize,
    cropSize,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas.toDataURL("image/jpeg", 0.78);
}

function PlayerIdentityForm({
  initialIdentity,
  firstUse,
  onSave,
  onCancel,
}: {
  initialIdentity: PlayerIdentity | null;
  firstUse: boolean;
  onSave: (identity: PlayerIdentity) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const [nickname, setNickname] = useState(initialIdentity?.nickname ?? "");
  const [avatar, setAvatar] = useState(normalizePlayerAvatar(initialIdentity?.avatar ?? defaultPlayerAvatar));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleUpload(file: File | undefined) {
    if (!file) return;
    setError("");
    setSaving(true);
    try {
      setAvatar(await readAvatarFile(file));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load that photo.");
    } finally {
      setSaving(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = nickname.trim();
    if (!cleanName) {
      setError("Enter a nickname for your player card.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      await onSave({ nickname: cleanName.slice(0, 24), avatar });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save your player card.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`identity-experience ${firstUse ? "identity-first-use" : "identity-edit-mode"}`}>
      <form className="identity-workspace" onSubmit={submit}>
        <header className="identity-header">
          <Logo />
          <span className="identity-progress"><i /> PLAYER SETUP <b>01 <em>/ 01</em></b></span>
          {!firstUse && onCancel && (
            <button type="button" className="identity-close" onClick={onCancel} aria-label="Close profile editor">
              <Icon name="x" />
            </button>
          )}
        </header>
        <div className="identity-layout">
          <section className="identity-showcase" aria-label="Live player card preview">
            <div className="identity-copy">
              <span className="identity-eyebrow"><i /> YOUR PLAYER CARD</span>
              <h1>{firstUse ? <>Be known.<br /><span>Stay unreadable.</span></> : <>Make it<br /><span>recognizably you.</span></>}</h1>
              <p>A familiar face for your crew. A different role every time.</p>
            </div>
            <article className="identity-card-preview">
              <div className="identity-card-topline">
                <span>IMPOSTER <i>®</i></span>
                <span>PLAYER NO. 001</span>
              </div>
              <div className="identity-card-art">
                <span className="identity-card-orbit identity-orbit-one" />
                <span className="identity-card-orbit identity-orbit-two" />
                <span className="identity-card-sigil"><i /><i /></span>
                <PlayerAvatar avatar={avatar} nickname={nickname || "Player"} className="identity-preview-avatar" />
                <span className="identity-card-star">✳</span>
              </div>
              <div className="identity-card-name">
                <small>KNOWN AS</small>
                <strong>{nickname.trim() || "YOUR NAME"}</strong>
              </div>
              <div className="identity-card-bottom">
                <span><i /> IDENTITY LOCKED IN</span>
                <span>ROLE: <b>UNKNOWN</b></span>
              </div>
            </article>
            <div className="identity-card-caption">
              <span>01</span><i /><span>YOUR ROLE CHANGES. YOUR CARD DOESN&apos;T.</span>
            </div>
          </section>

          <section className="identity-editor">
            <div className="identity-editor-heading">
              <span>LET&apos;S GET YOU IN THE GAME</span>
              <p>Your profile lives on this device. No account, no fuss.</p>
            </div>
            <label className="identity-field">
              <span><b>01</b> PLAYER NAME</span>
              <div className="identity-input-wrap">
                <input
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={24}
                  autoComplete="nickname"
                  placeholder="What should we call you?"
                  autoFocus={firstUse}
                />
                <small>{nickname.length}<i>/24</i></small>
              </div>
              <small className="identity-field-note">This is how you&apos;ll appear to your friends.</small>
            </label>
            <div className="avatar-picker">
              <div className="avatar-picker-heading">
                <span><b>02</b> PICK YOUR LOOK</span>
                <label className="avatar-upload">
                  <Icon name="plus" size={13} /> Add a photo
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) => {
                      void handleUpload(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="avatar-options">
                {playerAvatars.map((option, index) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`avatar-option avatar-option-${index}${avatar === option.id ? " selected" : ""}`}
                    onClick={() => setAvatar(option.id)}
                    aria-label={`Choose ${option.name} avatar`}
                    aria-pressed={avatar === option.id}
                    title={option.name}
                  >
                    <AvatarIllustration avatar={option.id} />
                    {avatar === option.id && <i className="avatar-selection-mark"><Icon name="check" size={10} /></i>}
                  </button>
                ))}
              </div>
              <p className="identity-field-note">{avatar.startsWith("data:image/") ? "Your photo is ready." : "Pick a character, or bring your own."}</p>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="identity-submit-row">
              <button className="identity-save" disabled={saving || !nickname.trim()}>
                <span>{saving ? "PREPARING YOUR CARD…" : firstUse ? "MAKE IT OFFICIAL" : "SAVE CHANGES"}</span>
                <i><Icon name="arrow" size={17} /></i>
              </button>
              <small><Icon name="lock" size={12} /> YOUR ROLE STAYS SECRET. ALWAYS.</small>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}

function Home({
  identity,
  onEditIdentity,
  onCreate,
  onJoin,
}: {
  identity: PlayerIdentity;
  onEditIdentity: () => void;
  onCreate: (mode: GameSettings["gameMode"]) => void;
  onJoin: (code: string) => Promise<void>;
}) {
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");

  async function handleJoin() {
    setError("");
    setJoining(true);
    try {
      await onJoin(code);
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
          <button className="avatar-button" aria-label="Edit player profile" onClick={onEditIdentity}>
            <PlayerAvatar avatar={identity.avatar} nickname={identity.nickname} />
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
            <button className="primary-button" onClick={() => onCreate("classic")}>
              <span className="play-icon">▶</span>Play now
              <Icon name="arrow" />
            </button>
            <div className="secondary-actions">
              <button className="secondary-button" onClick={() => onCreate("classic")}>
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
            <button className="mode-card featured" onClick={() => onCreate("classic")}>
              <span className="mode-icon">
                <ModeArtwork mode="classic" />
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
            <button className="mode-card rapid-mode-card" onClick={() => onCreate("rapid")}>
              <span className="mode-icon purple">
                <ModeArtwork mode="rapid" />
              </span>
              <span className="mode-copy">
                <b>Rapid fire</b>
                <small>Think fast. Talk faster.</small>
              </span>
              <span className="mode-meta">
                <i>20 sec</i>
                <Icon name="chevron" />
              </span>
            </button>
            <button className="mode-card" disabled>
              <span className="mode-icon dark">
                <ModeArtwork mode="world" />
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
            <p>Your player card is ready. Enter the 6-character code from your host.</p>
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
              disabled={joining || code.length !== 6}
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
  gameMode: "classic",
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
  identity,
  onEditIdentity,
  initialSettings,
  roomExists,
  onBack,
  onCreate,
}: {
  identity: PlayerIdentity;
  onEditIdentity: () => void;
  initialSettings: GameSettings;
  roomExists: boolean;
  onBack: () => void;
  onCreate: (settings: GameSettings) => Promise<void>;
}) {
  const [imposters, setImposters] = useState(initialSettings.imposters);
  const [players, setPlayers] = useState(initialSettings.maxPlayers);
  const [category, setCategory] = useState(initialSettings.category);
  const [difficulty, setDifficulty] = useState(initialSettings.difficulty);
  const [gameMode, setGameMode] = useState(initialSettings.gameMode ?? "classic");
  const [timer, setTimer] = useState(initialSettings.clueTimer);
  const [hint, setHint] = useState(initialSettings.imposterHint);
  const [finalGuess, setFinalGuess] = useState(initialSettings.finalGuess);
  const [customRules, setCustomRules] = useState(Boolean(initialSettings.customRules));
  const [rulesText, setRulesText] = useState(initialSettings.customRules);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const settings: GameSettings = {
    gameMode,
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
      await onCreate(settings);
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
          <button className="avatar-button" aria-label="Edit player profile" onClick={onEditIdentity}>
            <PlayerAvatar avatar={identity.avatar} nickname={identity.nickname} />
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
        <section className="game-mode-picker" aria-label="Choose a game mode">
          <button
            className={gameMode === "classic" ? "selected" : ""}
            onClick={() => setGameMode("classic")}
          >
            <Icon name="bolt" size={16} />
            <span>
              <b>Classic</b>
              <small>Time per player</small>
            </span>
          </button>
          <button
            className={gameMode === "rapid" ? "selected rapid-selected" : ""}
            onClick={() => setGameMode("rapid")}
          >
            <Icon name="clock" size={16} />
            <span>
              <b>Rapid Fire</b>
              <small>20 seconds per player</small>
            </span>
          </button>
        </section>
        {gameMode === "rapid" && (
          <p className="mode-description">
            Players take turns giving one-word clues. Each player gets 20 seconds, and everyone can
            read each clue before the next turn. Then vote as usual.
          </p>
        )}
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
              {gameMode === "rapid" ? (
                <div className="rapid-timer-setting">
                  <div className="setting-icon purple">
                    <Icon name="clock" />
                  </div>
                  <div className="setting-copy">
                    <b>Quick clue turns</b>
                    <small>Time for everyone to hear each clue</small>
                  </div>
                  <strong>20<small> sec</small></strong>
                </div>
              ) : (
                <>
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
                </>
              )}
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
              <Icon name="clock" size={17} />{" "}
              {gameMode === "rapid" ? "20s per player" : `${timer}s turns`}
            </span>
          </div>
          <div className="create-submit">
            <button
              className="primary-button"
              disabled={saving}
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
  identity,
  onEditIdentity,
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
  identity: PlayerIdentity;
  onEditIdentity: () => void;
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
          <button className="avatar-button" aria-label="Edit player profile" onClick={onEditIdentity}>
            <PlayerAvatar avatar={identity.avatar} nickname={identity.nickname} />
          </button>
          {isHost && (
            <button className="icon-button" aria-label="Edit game settings" onClick={onEdit}>
              <Icon name="edit" />
            </button>
          )}
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
                <PlayerAvatar avatar={player.avatar} nickname={player.display_name}
                  className={`face ${["face-blue", "face-orange", "face-purple", "face-green"][index % 4]}`} />
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
          <span>
            {room.settings.gameMode === "rapid"
              ? "Rapid Fire · 20s per clue"
              : `${room.settings.clueTimer}s per clue`}
          </span>
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
  identity,
  onEditIdentity,
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
  identity: PlayerIdentity;
  onEditIdentity: () => void;
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
  const revealRoleButton = useRef<HTMLButtonElement>(null);
  const hideRoleButton = useRef<HTMLButtonElement>(null);
  const roleHasBeenOpened = useRef(false);
  const myPlayer = players.find((player) => player.id === userId);
  const currentPlayer = players.find((player) => player.id === game.current_turn_player_id);
  const currentClues = clues.filter((entry) => entry.round_number === game.round_number);
  const myClue = currentClues.find((entry) => entry.player_id === userId);
  const activePlayerCount = players.filter((player) => !player.is_eliminated).length;

  function playerAvatar(id: string) {
    const player = players.find((entry) => entry.id === id);
    return player ? (
      <PlayerAvatar avatar={player.avatar} nickname={player.display_name} className="game-list-avatar" />
    ) : null;
  }

  useEffect(() => {
    setVoted(hasVoted);
  }, [game.phase, hasVoted]);

  useEffect(() => {
    setRevealed(false);
  }, [game.round_number, game.phase]);

  useEffect(() => {
    if (!roleHasBeenOpened.current) return;
    const activeButton = revealed ? hideRoleButton.current : revealRoleButton.current;
    activeButton?.focus({ preventScroll: true });
  }, [revealed]);

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
          <button className="avatar-button" aria-label="Edit player profile" onClick={onEditIdentity}>
            <PlayerAvatar avatar={identity.avatar} nickname={identity.nickname} />
          </button>
          <span className="game-round">
            Round {game.round_number} · {room.code}
          </span>
        </div>
      </header>
      <main className="lobby game-main">
        <span className="lobby-status">
          <i /> {room.settings.gameMode === "rapid" ? "Rapid Fire" : "Game in progress"}
        </span>
        <p className="kicker">
          {game.phase === "clue"
            ? room.settings.gameMode === "rapid"
              ? "Rapid Fire · clue turn"
              : "Clue round"
            : game.phase === "vote"
              ? "Time to vote"
              : game.phase === "final_guess"
                ? "Final guess"
                : "Game over"}
        </p>
        <h1 className="game-heading">
          {game.phase === "clue"
            ? room.settings.gameMode === "rapid"
              ? "Think fast."
              : "Stay subtle."
            : game.phase === "vote"
              ? "Who’s the imposter?"
              : game.phase === "final_guess"
                ? "One last chance."
                : "The truth is out."}
        </h1>
        {game.phase !== "result" && (
          <div
            className={`role-card-scene ${revealed ? "is-revealed" : ""} ${role?.is_imposter ? "imposter-role" : ""}`}
          >
            <div className="role-card-flipper">
              <button
                className="role-card-face role-card-hidden"
                ref={revealRoleButton}
                onClick={() => {
                  roleHasBeenOpened.current = true;
                  setRevealed(true);
                }}
                disabled={!role}
                aria-label="Tap to reveal your secret role"
                aria-hidden={revealed}
                tabIndex={revealed ? -1 : 0}
              >
                <span className="role-card-index">PLAYER / {String(game.round_number).padStart(2, "0")}</span>
                <span className="mystery-eyes" aria-hidden="true"><i /><i /></span>
                <strong>WHO&apos;S FAKING IT?</strong>
                <small>{role ? "Tap to reveal your role" : "Loading your private role…"}</small>
              </button>
              <div
                className="role-card-face role-card-revealed"
                aria-live="polite"
                aria-hidden={!revealed}
              >
                {role && (
                  <>
                    <span className="role-card-index">{role.is_imposter ? "IDENTITY UNKNOWN" : "CIVILIAN"}</span>
                    <PlayerAvatar
                      avatar={identity.avatar}
                      nickname={identity.nickname}
                      className="role-card-avatar"
                    />
                    <small className="role-card-known-as">KNOWN AS</small>
                    <b className="role-card-nickname">{identity.nickname}</b>
                    <span className="role-card-role">{role.is_imposter ? "IMPOSTER" : "CIVILIAN"}</span>
                    {role.is_imposter ? (
                      <p className="role-card-secret">
                        {role.category_hint ? `CATEGORY · ${role.category_hint}` : "BLEND IN. FIND THE WORD."}
                      </p>
                    ) : (
                      <>
                        <small className="role-card-word-label">YOUR SECRET WORD</small>
                        <strong className="role-card-word">{role.word}</strong>
                        {role.category && <span className="role-card-category">{role.category}</span>}
                      </>
                    )}
                    <button
                      ref={hideRoleButton}
                      className="role-hide-button"
                      onClick={() => setRevealed(false)}
                      tabIndex={revealed ? 0 : -1}
                    >
                      Hide role
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
        {game.phase === "clue" && (
          <section className="game-panel">
            {room.settings.customRules && (
              <p className="lobby-message">House rule: {room.settings.customRules}</p>
            )}
            <p>
              {myPlayer?.is_eliminated
                ? "You were voted out. Watch the remaining players finish the game."
                : room.settings.gameMode === "rapid"
                  ? myPlayer?.is_eliminated
                    ? "You were voted out. Watch the remaining players finish the round."
                    : myClue
                      ? "Your clue is in. Listen to the next player and keep track of the clues."
                      : currentPlayer?.id === userId
                        ? "Your turn. Give one word that hints at the secret without revealing it."
                        : `${playerName(game.current_turn_player_id)} is giving a clue. Listen carefully.`
                : currentPlayer?.id === userId
                  ? "It’s your turn. Give a clue that does not reveal the word."
                  : `${playerName(game.current_turn_player_id)} is giving a clue.`}
            </p>
            {room.settings.gameMode === "rapid" && (
              <div className="rapid-round-status" role="status">
                <span>
                  {currentClues.length} / {activePlayerCount} clues submitted
                </span>
                <span>
                  {currentPlayer
                    ? `${currentPlayer.display_name} · ${secondsRemaining}s`
                    : `${secondsRemaining}s`}
                </span>
              </div>
            )}
            {currentClues.map((entry) => (
              <div className="clue-row" key={entry.id}>
                <b className="game-clue-player">{playerAvatar(entry.player_id)}{playerName(entry.player_id)}</b>
                <span>{entry.clue}</span>
              </div>
            ))}
            {!myPlayer?.is_eliminated &&
              game.current_turn_player_id === userId &&
              !myClue && (
                <div className="game-action">
                  <input
                    value={clue}
                    maxLength={80}
                    onChange={(event) => setClue(event.target.value)}
                    placeholder={
                      room.settings.gameMode === "rapid"
                        ? "Your one-word clue"
                        : "Your clue (max 80 characters)"
                    }
                  />
                  <button
                    className="primary-button"
                    disabled={
                      busy ||
                      !clue.trim() ||
                      (room.settings.gameMode === "rapid" && /\s/.test(clue.trim()))
                    }
                    onClick={() => onClue(clue)}
                  >
                    {room.settings.gameMode === "rapid" ? "Send one-word clue" : "Send clue"}{" "}
                    <Icon name="arrow" />
                  </button>
                  {room.settings.gameMode === "rapid" && /\s/.test(clue.trim()) && (
                    <small className="rapid-clue-hint">Rapid Fire clues must be one word.</small>
                  )}
                </div>
              )}
            {room.settings.gameMode !== "rapid" && (
              <small>{secondsRemaining} seconds remaining in this turn</small>
            )}
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
                      <span className="game-vote-player"><PlayerAvatar avatar={player.avatar} nickname={player.display_name} className="game-list-avatar" />{player.display_name}</span>
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
                        {playerAvatar(player.player_id)}
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
  const [identity, setIdentity] = useState<PlayerIdentity | null>(() => savedIdentity());
  const [profileOpen, setProfileOpen] = useState(false);
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

  async function handleJoin(code: string) {
    if (!identity) throw new Error("Create your player card before joining a game.");
    const response = await joinRoom(code, identity.nickname, identity.avatar);
    await enterRoom(response);
  }

  async function handleCreate(settingsToSave: GameSettings) {
    if (!identity) throw new Error("Create your player card before starting a game.");
    setBusy(true);
    setError("");
    try {
      if (roomId && snapshot) {
        await updateRoomSettings(roomId, settingsToSave);
        setSettings(settingsToSave);
        setScreen("room");
      } else {
        const response = await createRoom(identity.nickname, settingsToSave, identity.avatar);
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

  async function handleSaveIdentity(nextIdentity: PlayerIdentity) {
    if (roomId) await updateMyIdentity(roomId, nextIdentity.nickname, nextIdentity.avatar);
    const saved = saveIdentity(nextIdentity);
    setIdentity(saved);
    setProfileOpen(false);
    if (roomId) setSnapshot(await loadRoom(roomId));
  }

  if (!identity) {
    return (
      <PlayerIdentityForm
        initialIdentity={null}
        firstUse
        onSave={(nextIdentity) => {
          setIdentity(saveIdentity(nextIdentity));
        }}
      />
    );
  }

  let page: React.ReactNode;
  if (screen === "home") {
    page = (
      <Home
        identity={identity}
        onEditIdentity={() => setProfileOpen(true)}
        onCreate={(mode) => {
          setSettings({ ...defaultSettings, gameMode: mode });
          setScreen("create");
        }}
        onJoin={handleJoin}
      />
    );
  } else if (screen === "create") {
    page = (
      <CreateGame
        identity={identity}
        onEditIdentity={() => setProfileOpen(true)}
        initialSettings={roomId ? (snapshot?.room.settings ?? settings) : settings}
        roomExists={Boolean(roomId)}
        onBack={() => setScreen(roomId ? "room" : "home")}
        onCreate={handleCreate}
      />
    );
  } else if (!snapshot) {
    page = (
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
  } else if (snapshot.game) {
    page = (
      <GameScreen
        identity={identity}
        onEditIdentity={() => setProfileOpen(true)}
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
  } else {
    page = (
      <Lobby
        identity={identity}
        onEditIdentity={() => setProfileOpen(true)}
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

  return (
    <>
      {page}
      {profileOpen && (
        <PlayerIdentityForm
          initialIdentity={identity}
          firstUse={false}
          onCancel={() => setProfileOpen(false)}
          onSave={handleSaveIdentity}
        />
      )}
    </>
  );
}
