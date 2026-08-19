import { create } from 'zustand';

/**
 * Transient UI state that several unrelated components need to read or set —
 * the cart drawer, the command-style search, and the mobile navigation.
 * Domain data lives in TanStack Query, not here.
 */
interface UiState {
  isCartOpen: boolean;
  isSearchOpen: boolean;
  isMobileNavOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  setCartOpen: (open: boolean) => void;
  openSearch: () => void;
  setSearchOpen: (open: boolean) => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set) => ({
  isCartOpen: false,
  isSearchOpen: false,
  isMobileNavOpen: false,
  openCart: () => set({ isCartOpen: true }),
  closeCart: () => set({ isCartOpen: false }),
  setCartOpen: (open) => set({ isCartOpen: open }),
  openSearch: () => set({ isSearchOpen: true }),
  setSearchOpen: (open) => set({ isSearchOpen: open }),
  setMobileNavOpen: (open) => set({ isMobileNavOpen: open }),
}));

const RECENT_KEY = 'alaap.recentSearches';
const RECENT_LIMIT = 6;

export function getRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
}

export function addRecentSearch(term: string): string[] {
  const trimmed = term.trim();
  if (trimmed.length < 2) return getRecentSearches();

  const next = [trimmed, ...getRecentSearches().filter((entry) => entry.toLowerCase() !== trimmed.toLowerCase())].slice(
    0,
    RECENT_LIMIT,
  );

  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Private browsing can reject writes; recent searches are non-essential.
  }
  return next;
}

export function clearRecentSearches(): void {
  try {
    localStorage.removeItem(RECENT_KEY);
  } catch {
    // Ignore.
  }
}
