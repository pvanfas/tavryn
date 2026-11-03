import type { SVGProps } from "react";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export interface AgentIconProps extends SVGProps<SVGSVGElement> {
  size?: number | string;
}

/**
 * Institutional autonomous processor / agent mark (geometric core with workflow nodes).
 * Replaces generic AI sparkle slop with a precise technical agent icon.
 */
export const AgentIcon = forwardRef<SVGSVGElement, AgentIconProps>(
  ({ className, size = 16, width, height, ...props }, ref) => {
    return (
      <svg
        ref={ref}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        width={width ?? size}
        height={height ?? size}
        className={cn("inline-block shrink-0", className)}
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        {...props}
      >
        {/* Central processor core */}
        <rect x="5" y="5" width="14" height="14" rx="3" />
        <circle cx="12" cy="12" r="2.5" />
        {/* Node connectors */}
        <path d="M12 2v3" />
        <path d="M12 19v3" />
        <path d="M2 12h3" />
        <path d="M19 12h3" />
      </svg>
    );
  },
);

AgentIcon.displayName = "AgentIcon";

export default AgentIcon;
