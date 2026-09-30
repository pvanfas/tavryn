/**
 * Centralized Navigation Configuration for Tavryn
 * Single source of truth for sidebar, mobile drawer, and landing page navigation.
 * A link cannot exist without a valid target route.
 */

export interface NavItemConfig {
  label: string;
  href: string;
  iconName: "LayoutDashboard" | "ShieldCheck" | "History" | "BarChart3" | "PlusCircle" | "SettingsIcon";
  badge?: string;
  pulseBadge?: boolean;
  matchNested?: boolean;
}

export interface NavGroupConfig {
  label: string;
  items: NavItemConfig[];
}

export const SIDEBAR_NAV_GROUPS: NavGroupConfig[] = [
  {
    label: "Overview",
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        iconName: "LayoutDashboard",
        matchNested: true, // Also active on /negotiate/[id] and /decision/[id]
      },
    ],
  },
  {
    label: "Governance & Finance",
    items: [
      {
        label: "Policy Engine",
        href: "/settings",
        iconName: "ShieldCheck",
      },
      {
        label: "Audit Ledger",
        href: "/audit",
        iconName: "History",
        badge: "Chained",
      },
      {
        label: "Traction & Metrics",
        href: "/metrics",
        iconName: "BarChart3",
        badge: "Live",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Onboard Subscriptions",
        href: "/onboard",
        iconName: "PlusCircle",
      },
    ],
  },
];

export interface LandingNavLink {
  label: string;
  href: string;
  isExternal?: boolean;
}

export const LANDING_NAV_LINKS: LandingNavLink[] = [
  { label: "The 3-Step Loop", href: "#how-it-works" },
  { label: "Impact", href: "#metrics" },
  { label: "Security", href: "#architecture" },
  { label: "GitHub", href: "https://github.com/pvanfas/tavryn", isExternal: true },
];

export const FOOTER_NAV_LINKS: LandingNavLink[] = [
  { label: "Audit Trail", href: "/audit" },
  { label: "Dashboard", href: "/dashboard" },
  { label: "GitHub", href: "https://github.com/pvanfas/tavryn", isExternal: true },
];

/**
 * Deterministic helper to evaluate whether a route is active.
 * Accurately highlights parent routes for nested dynamic segments.
 */
export function isRouteActive(pathname: string, href: string, matchNested = false): boolean {
  if (!pathname || !href) return false;

  // Exact match
  if (pathname === href) return true;

  // Nested matching (e.g. /dashboard for /negotiate/* or /decision/* or /dashboard/*)
  if (matchNested && href === "/dashboard") {
    if (pathname.startsWith("/negotiate") || pathname.startsWith("/decision") || pathname.startsWith("/dashboard")) {
      return true;
    }
  }

  // Generic prefix matching for other sections
  if (href !== "/" && href !== "/dashboard" && pathname.startsWith(href)) {
    return true;
  }

  return false;
}

/**
 * Retrieves all unique internal application routes configured in navigation.
 * Used for automated Playwright link-checking and smoke tests.
 */
export function getAllAppNavRoutes(): Array<{ label: string; href: string }> {
  const routes: Array<{ label: string; href: string }> = [];
  const seen = new Set<string>();

  for (const group of SIDEBAR_NAV_GROUPS) {
    for (const item of group.items) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        routes.push({ label: item.label, href: item.href });
      }
    }
  }

  return routes;
}
