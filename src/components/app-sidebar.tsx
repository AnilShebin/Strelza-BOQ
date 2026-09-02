import * as React from "react"
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
  Building2,
  Boxes,
  FolderOpen,
  Save,
} from "lucide-react"

// Default teams with Strelza BOQ as primary
const data = {
  user: {
    name: "Anil Shebin",
    email: "anil.shebin@strelza.com",
    avatar: "https://github.com/shadcn.png",
  },
  teams: [
    {
      name: "Strelza BOQ",
      logo: <Icon name="logo" size={26} />,
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
    ...(onOpenProject
      ? [
          {
            title: "Open Project (.slz)",
            id: "open-project",
            icon: <FolderOpen className="size-4" />,
            onClick: onOpenProject,
          },
        ]
      : []),
    ...(onSaveProject
      ? [
          {
            title: "Save Project (.slz)",
            id: "save-project",
            icon: <Save className="size-4 text-primary" />,
            onClick: onSaveProject,
          },
        ]
      : []),
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
      <SidebarHeader className="border-b border-border/80 p-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent className="p-2 gap-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:gap-0">
        <NavMain items={data.navMain} activeTab={activeTab} onTabChange={onTabChange} />
        <NavSecondary items={secondaryNavItems} className="mt-auto border-t border-border/80 pt-2 group-data-[collapsible=icon]:p-0 group-data-[collapsible=icon]:pt-0" />
      </SidebarContent>
      <SidebarFooter className="border-t border-border/80 p-2 group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:h-12 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:items-center group-data-[collapsible=icon]:justify-center">
        <NavUser user={data.user} onSignOut={onSignOut} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
