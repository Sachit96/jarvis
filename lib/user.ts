// Single-user app — no auth, no profiles table (dropped in migration 0012).
// This is the one place identity is defined; every place the UI shows the
// user's name/avatar should import from here rather than hardcoding it.
export const user = {
  name: "Sachit",
  workspace: "Personal workspace",
  avatar: "/avatar.jpg",
  initial: "S",
};

// Sidebar wordmark shown in the header (replaces the plain "JARVIS / Personal OS"
// text lockup). Falls back to that text if the file isn't present yet — see
// the onError handler in Sidebar.
export const brand = {
  logo: "/jarvis-logo.png",
};
