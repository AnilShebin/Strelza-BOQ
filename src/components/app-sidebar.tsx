"use client"

import * as React from "react"
import {
  Boxes,
  Building2,
  Cpu,
  FileText,
  Layers,
  LayoutDashboard,
  Moon,
  Settings2,
  Sun,
  Tag,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { Icon } from "@/components/common/Icon"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

// Content preserved with exact shadcn sidebar-07 schema
const data = {
  user: {
    name: "Anil Shebin",
    email: "anil.shebin@strelza.com",
    avatar: "https://github.com/shadcn.png",
  },
  teams: [
    {
      name: "Strelza BOQ",
      logo: <Icon name="logo" size={20} />,
      plan: "Enterprise Workspace",
    },
    {
      name: "Strelza MEP Projects",
      logo: <Building2 className="size-4 text-primary" />,
      plan: "Commercial Trade",
    },
    {
      name: "Civil & Infrastructure",
      logo: <Boxes className="size-4 text-primary" />,
      plan: "Site Takeoffs",
    },
  ],
  navMain: [
    {
      id: "dashboard",
      title: "Dashboard",
      icon: <LayoutDashboard className="size-4" />,
      isActive: true,
    },
    {
      id: "documents",
      title: "Documents",
      icon: <FileText className="size-4" />,
    },
    {
      id: "boq",
      title: "BOQ Viewer",
      icon: <Layers className="size-4" />,
    },
    {
      id: "equipment",
      title: "Equipment",
      icon: <Cpu className="size-4" />,
    },
    {
      id: "pricelist",
      title: "Master Prices",
      icon: <Tag className="size-4" />,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab?: string
  onTabChange?: (tab: string) => void
  theme?: "light" | "dark"
  onToggleTheme?: () => void
  onOpenProject?: () => void
  onSaveProject?: () => void
  onSignOut?: () => void
}

export function AppSidebar({
  activeTab,
  onTabChange,
  theme = "light",
  onToggleTheme,
  onOpenProject,
  onSaveProject,
  onSignOut,
  ...props
}: AppSidebarProps) {
  const secondaryNavItems = [
    {
      title: "Settings",
      id: "settings",
      icon: <Settings2 className="size-4" />,
      onClick: () => onTabChange?.("settings"),
      isActive: activeTab === "settings",
    },
    {
      title: theme === "light" ? "Dark Mode" : "Light Mode",
      icon: theme === "light" ? <Moon className="size-4" /> : <Sun className="size-4" />,
      onClick: onToggleTheme,
    },
  ]

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} activeTab={activeTab} onTabChange={onTabChange} />
        <NavSecondary items={secondaryNavItems} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
