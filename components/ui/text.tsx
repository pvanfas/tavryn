/**
 * Typography Primitives — Tavryn Design System
 *
 * Maps the @theme scale tokens in globals.css to composable React elements.
 * Each primitive accepts:
 *   - `as` — override the HTML element rendered (default shown below)
 *   - `className` — merge additional Tailwind classes
 *   - Standard HTML attributes for the resolved element
 *
 * Scale reference:
 *   Display  → 48px / 1.1lh  / weight 800  — hero savings number, landing headline
 *   H1       → 36px / 1.15lh / weight 700  — page title ("Money overview")
 *   H2       → 24px / 1.25lh / weight 700  — section headers ("Opportunities")
 *   H3       → 18px / 1.35lh / weight 600  — card titles, table column headers
 *   Body     → 14px / 1.5lh  / weight 400  — default UI text, table cells
 *   BodySm   → 13px / 1.45lh / weight 500  — secondary text, timestamps, meta
 *   Caption  → 12px / 1.4lh  / weight 600  — labels, uppercase badges
 *   Mono     → 13px / 1.5lh  / weight 600  — amounts, tx hashes, code, addresses
 */

import React from "react";

// ─── Shared types ─────────────────────────────────────────────────────────────

type AsProp<E extends React.ElementType> = {
  as?: E;
};

type PropsWithAs<E extends React.ElementType, P = object> = AsProp<E> &
  Omit<
    React.ComponentPropsWithoutRef<E>,
    keyof AsProp<E> | "className" | "children"
  > &
  P & {
    className?: string;
    children?: React.ReactNode;
  };

function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(" ");
}

// ─── Display ─────────────────────────────────────────────────────────────────
// 48px | extrabold | letter-spacing -0.02em
// Use for: hero savings figures, top-level landing numbers

export function Display<E extends React.ElementType = "p">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "p") as React.ElementType;
  return (
    <Tag
      className={cn(
        "text-display font-extrabold tracking-tight leading-none",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ─── H1 ───────────────────────────────────────────────────────────────────────
// 36px | bold | letter-spacing -0.02em
// Use for: page titles

export function H1<E extends React.ElementType = "h1">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "h1") as React.ElementType;
  return (
    <Tag
      className={cn(
        "text-xl sm:text-2xl md:text-h1 font-bold tracking-tight",
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ─── H2 ───────────────────────────────────────────────────────────────────────
// 24px | bold | letter-spacing -0.01em
// Use for: section headers, panel titles

export function H2<E extends React.ElementType = "h2">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "h2") as React.ElementType;
  return (
    <Tag
      className={cn("text-h2 font-bold tracking-tight", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ─── H3 ───────────────────────────────────────────────────────────────────────
// 18px | semibold | letter-spacing 0
// Use for: card titles, table column headers

export function H3<E extends React.ElementType = "h3">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "h3") as React.ElementType;
  return (
    <Tag className={cn("text-h3 font-bold", className)} {...rest}>
      {children}
    </Tag>
  );
}

// ─── Body ─────────────────────────────────────────────────────────────────────
// 14px | normal | letter-spacing 0
// Use for: default UI text, table cells, descriptions

export function Body<E extends React.ElementType = "p">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "p") as React.ElementType;
  return (
    <Tag className={cn("text-body font-normal", className)} {...rest}>
      {children}
    </Tag>
  );
}

// ─── BodySmall ────────────────────────────────────────────────────────────────
// 13px | medium | letter-spacing 0
// Use for: secondary text, timestamps, metadata, help copy

export function BodySmall<E extends React.ElementType = "p">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "p") as React.ElementType;
  return (
    <Tag className={cn("text-body-sm font-medium", className)} {...rest}>
      {children}
    </Tag>
  );
}

// ─── Caption ─────────────────────────────────────────────────────────────────
// 12px | semibold | letter-spacing +0.01em
// Use for: uppercase labels, stat card headers, badge text, footnotes

export function Caption<E extends React.ElementType = "span">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "span") as React.ElementType;
  return (
    <Tag className={cn("text-caption font-semibold", className)} {...rest}>
      {children}
    </Tag>
  );
}

// ─── Mono ─────────────────────────────────────────────────────────────────────
// 13px | semibold | font-mono | letter-spacing 0
// Use for: USDC amounts, wallet addresses, tx hashes, code snippets

export function Mono<E extends React.ElementType = "span">({
  as,
  className,
  children,
  ...rest
}: PropsWithAs<E>) {
  const Tag = (as || "span") as React.ElementType;
  return (
    <Tag
      className={cn("text-mono font-mono font-semibold", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
