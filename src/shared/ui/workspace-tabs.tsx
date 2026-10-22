"use client";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

export function WorkspaceTabs({ tabs, sidebar = false, label = "Workspace sections" }: { tabs: { id: string; label: string; content: ReactNode }[]; sidebar?: boolean; label?: string }) {
  if (!tabs.length) return null;
  return <Tabs.Root defaultValue={tabs[0].id} orientation={sidebar ? "vertical" : "horizontal"} className={`workspace-tabs${sidebar ? " workspace-tabs-sidebar" : ""}`}>
    <Tabs.List className="workspace-tab-list" aria-label={label}>
      {tabs.map(tab => <Tabs.Trigger key={tab.id} value={tab.id}>{tab.label}</Tabs.Trigger>)}
    </Tabs.List>
    {tabs.map(tab => <Tabs.Content key={tab.id} value={tab.id} forceMount className="workspace-tab-content">{tab.content}</Tabs.Content>)}
  </Tabs.Root>;
}
