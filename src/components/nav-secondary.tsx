import * as React from "react"

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

export function NavSecondary({
  items,
  ...props
}: {
  items: {
    title: string
    url?: string
    id?: string
    icon: React.ReactNode
    onClick?: () => void
    isActive?: boolean
  }[]
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  return (
    <SidebarGroup {...props}>
      <SidebarGroupContent>
        <SidebarMenu className="gap-1">
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                tooltip={item.title}
                isActive={item.isActive}
                onClick={item.onClick}
                asChild={!!item.url && !item.onClick}
              >
                {item.url && !item.onClick ? (
                  <a href={item.url}>
                    {item.icon}
                    <span className="group-data-[collapsible=icon]:hidden font-medium">{item.title}</span>
                    <span className="hidden group-data-[collapsible=icon]:block text-[9px] font-semibold tracking-tight text-center">
                      {item.title === 'Dark Mode' || item.title === 'Light Mode'
                        ? item.title === 'Dark Mode' ? 'Dark' : 'Light'
                        : item.title}
                    </span>
                  </a>
                ) : (
                  <>
                    {item.icon}
                    <span className="group-data-[collapsible=icon]:hidden font-medium">{item.title}</span>
                    <span className="hidden group-data-[collapsible=icon]:block text-[9px] font-semibold tracking-tight text-center">
                      {item.title === 'Dark Mode' || item.title === 'Light Mode'
                        ? item.title === 'Dark Mode' ? 'Dark' : 'Light'
                        : item.title}
                    </span>
                  </>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

