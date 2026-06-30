/* Persistent admin navigation. Render at the top of every /ascend/admin/*
   page so admins can move between admin views without typing URLs. */
import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";

const FG = "#e8e8e8";
const MUTED = "#a0a0a0";
const LINE = "#262626";
const GOLD = "#e8c07a";
const TEAL = "#5cbdb9";

interface Item {
  label: string;
  to: string;
  matchPrefix?: string;
}

const ITEMS: Item[] = [
  { label: "Dashboard", to: "/ascend/admin", matchPrefix: "/ascend/admin" },
  { label: "Package Queue", to: "/ascend/admin/queue" },
  { label: "Manuscript Tracking", to: "/ascend/admin/manuscripts" },
];

export function AdminNav({ back }: { back?: { to: string; label: string } }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (item: Item) => {
    if (item.to === "/ascend/admin") return pathname === "/ascend/admin";
    return pathname === item.to || pathname.startsWith(item.to + "/");
  };

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        flexWrap: "wrap",
        padding: "14px 24px",
        borderBottom: `1px solid ${LINE}`,
        background: "#050505",
        fontSize: 12,
      }}
    >
      <span
        style={{
          fontSize: 10,
          letterSpacing: "0.24em",
          textTransform: "uppercase",
          color: GOLD,
          marginRight: 12,
        }}
      >
        Admin
      </span>

      {ITEMS.map((item) => {
        const active = isActive(item);
        return (
          <Link
            key={item.to}
            to={item.to}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: active ? "#111" : FG,
              background: active ? TEAL : "transparent",
              border: `1px solid ${active ? TEAL : LINE}`,
              fontWeight: active ? 700 : 500,
            }}
          >
            {item.label}
          </Link>
        );
      })}

      <div style={{ marginInlineStart: "auto", display: "flex", gap: 8, alignItems: "center" }}>
        {back && (
          <Link
            to={back.to}
            style={{
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              color: MUTED,
              textDecoration: "none",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            ← {back.label}
          </Link>
        )}
        <Link
          to="/dashboard"
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            border: `1px solid ${LINE}`,
            color: MUTED,
            textDecoration: "none",
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          User View →
        </Link>
      </div>
    </nav>
  );
}

export default AdminNav;
