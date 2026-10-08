/**
 * Centralized Navigation Configuration for Tavryn
 * Single source of truth for sidebar, mobile tab bar, and landing page navigation.
 * A link cannot exist without a valid target route.
 */

export interface NavItemConfig {
  id: string;
  label: string;
  href: string;
  iconName:
    | "LayoutDashboard"
    | "Activity"
    | "CheckSquare"
    | "MessageSquare"
    | "FileText"
    | "ShieldCheck"
    | "BarChart3"
    | "PlusCircle"
    | "SettingsIcon"
    | "FileSpreadsheet"
    | "Scale";
  badgeKey?: "approvals" | "audit" | "metrics";
  badgeText?: string;
  highlightNestedPrefixes?: string[];
}

export interface NavSectionConfig {
  title: string;
  items: NavItemConfig[];
}

export const WORKSPACE_NAV_SECTIONS: NavSectionConfig[] = [
  {
    title: "Act",
    items: [
      {
        id: "overview",
        label: "Dashboard",
        href: "/dashboard",
        iconName: "LayoutDashboard",
      },
      {
        id: "contracts",
        label: "Contracts",
        href: "/contracts",
        iconName: "FileText",
      },
      {
        id: "negotiations",
        label: "Negotiations",
        href: "/negotiations",
        iconName: "MessageSquare",
        highlightNestedPrefixes: ["/negotiate"],
      },
    ],
  },
  {
    title: "Trust",
    items: [
      {
        id: "approvals",
        label: "Approvals",
        href: "/approvals",
        iconName: "CheckSquare",
        badgeKey: "approvals",
      },
      {
        id: "audit",
        label: "Audit Trail",
        href: "/audit",
        iconName: "ShieldCheck",
        badgeText: "Chained",
      },
      {
        id: "decision",
        label: "Decision",
        href: "/decision",
        iconName: "Scale",
        highlightNestedPrefixes: ["/decision"],
      },
    ],
  },
  {
    title: "Prove",
    items: [
      {
        id: "metrics",
        label: "Metrics",
        href: "/metrics",
        iconName: "BarChart3",
        badgeText: "Live",
      },
    ],
  },
];

export const BOTTOM_NAV_ITEMS: NavItemConfig[] = [
  {
    id: "import-bills",
    label: "Import Bills",
    href: "/import-bills",
    iconName: "FileSpreadsheet",
  },
  {
    id: "settings",
    label: "Settings",
    href: "/settings",
    iconName: "SettingsIcon",
  },
];

/**
 * Primary tabs displayed on mobile bottom bar (below md)
 * Exactly 4 primary items + 1 More sheet button = 5 tabs total
 */
export const MOBILE_PRIMARY_TAB_IDS = [
  "overview",
  "contracts",
  "approvals",
  "metrics",
];

/**
 * Items displayed in the mobile "More" drawer/sheet
 */
export const MOBILE_MORE_ITEM_IDS = [
  "negotiations",
  "audit",
  "decision",
  "import-bills",
  "settings",
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
  {
    label: "GitHub",
    href: "https://github.com/pvanfas/tavryn",
    isExternal: true,
  },
];

export const FOOTER_NAV_LINKS: LandingNavLink[] = [
  { label: "Audit Trail", href: "/audit" },
  { label: "Dashboard", href: "/dashboard" },
  {
    label: "GitHub",
    href: "https://github.com/pvanfas/tavryn",
    isExternal: true,
  },
];

/**
 * Evaluates whether a route is currently active.
 * Accurately supports root matching, exact path matching, and nested prefixes.
 */
export function isRouteActive(
  pathname: string,
  href: string,
  highlightNestedPrefixes?: string[],
): boolean {
  if (!pathname || !href) return false;

  // Dashboard Overview matching
  if (href === "/dashboard") {
    if (
      pathname === "/dashboard" ||
      pathname.startsWith("/dashboard?") ||
      pathname.startsWith("/dashboard/")
    ) {
      return true;
    }
  } else if (pathname === href) {
    return true;
  }

  // Nested route prefix matching (e.g. /decision/[id] or /negotiate/[id] for Negotiations)
  if (highlightNestedPrefixes && highlightNestedPrefixes.length > 0) {
    for (const prefix of highlightNestedPrefixes) {
      if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
        return true;
      }
    }
  }

  // Standard prefix matching for non-root sections
  if (href !== "/" && href !== "/dashboard" && pathname.startsWith(href)) {
    return true;
  }

  return false;
}

/**
 * Retrieves all unique internal application routes configured in navigation.
 * Used for automated Playwright link-checking and smoke tests.
 */
export function getAllAppNavRoutes(): Array<{
  id: string;
  label: string;
  href: string;
}> {
  const routes: Array<{ id: string; label: string; href: string }> = [];
  const seen = new Set<string>();

  for (const section of WORKSPACE_NAV_SECTIONS) {
    for (const item of section.items) {
      if (!seen.has(item.href)) {
        seen.add(item.href);
        routes.push({ id: item.id, label: item.label, href: item.href });
      }
    }
  }

  for (const item of BOTTOM_NAV_ITEMS) {
    if (!seen.has(item.href)) {
      seen.add(item.href);
      routes.push({ id: item.id, label: item.label, href: item.href });
    }
  }

  return routes;
}
