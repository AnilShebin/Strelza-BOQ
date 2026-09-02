import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavMain({
  items,
  activeTab,
  onTabChange,
}: {
  items: {
    title: string
    id?: string
    url?: string
    icon?: React.ReactNode
    isActive?: boolean
  }[]
  activeTab?: string
  onTabChange?: (tab: string) => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">Platform</SidebarGroupLabel>
      <SidebarMenu className="gap-1">
        {items.map((item) => {
          const isItemActive = activeTab ? item.id === activeTab : item.isActive;
          return (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={isItemActive}
                onClick={() => {
                  if (item.id && onTabChange) onTabChange(item.id);
                }}
              >
                {item.icon}
                <span className="group-data-[collapsible=icon]:hidden font-medium">{item.title}</span>
                <span className="hidden group-data-[collapsible=icon]:block text-[9px] font-semibold tracking-tight text-center">
                  {item.title}
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

