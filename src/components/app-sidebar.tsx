import * as React from "react"

import { NavMain } from "@/components/nav-main"
import { NavSecondary } from "@/components/nav-secondary"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  LayoutDashboard,
  FileText,
  Layers,
  Cpu,
  Tag,
  Sliders,
  Settings2,
  Moon,
  Sun,
  GalleryVerticalEnd,
  AudioLines,
  Terminal,
} from "lucide-react"

// Default sidebar-07 data with direct BOQ navigation
const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "https://github.com/shadcn.png",
  },
  teams: [
    {
      name: "Acme Inc",
      logo: <GalleryVerticalEnd className="size-4" />,
      plan: "Enterprise",
    },
    {
      name: "Acme Corp.",
      logo: <AudioLines className="size-4" />,
      plan: "Startup",
    },
    {
      name: "Evil Corp.",
      logo: <Terminal className="size-4" />,
      plan: "Free",
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
    {
      id: "rules",
      title: "Rules",
      icon: <Sliders className="size-4" />,
    },
  ],
}

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab?: string
  onTabChange?: (tab: string) => void
  theme?: "light" | "dark"
  onToggleTheme?: () => void
  onSignOut?: () => void
}

export function AppSidebar({
  activeTab,
  onTabChange,
  theme = "light",
  onToggleTheme,
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



