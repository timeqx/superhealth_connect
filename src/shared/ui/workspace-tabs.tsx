"use client";
import { Tabs } from "radix-ui";
import type { ReactNode } from "react";

export function WorkspaceTabs({ tabs }: { tabs: { id: string; label: string; content: ReactNode }[] }) {
  return <Tabs.Root defaultValue={tabs[0].id} className="workspace-tabs">
    <Tabs.List className="workspace-tab-list" aria-label="Workspace sections">
      {tabs.map(tab => <Tabs.Trigger key={tab.id} value={tab.id}>{tab.label}</Tabs.Trigger>)}
    </Tabs.List>
    {tabs.map(tab => <Tabs.Content key={tab.id} value={tab.id} forceMount className="workspace-tab-content">{tab.content}</Tabs.Content>)}
  </Tabs.Root>;
}
