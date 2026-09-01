import * as React from "react"
import {
  columnFilteringFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createFilteredRowModel,
  createSortedRowModel,
  FlexRender,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
  useTable,
  type ColumnFiltersState,
  type ColumnVisibilityState,
  type Row,
  type SortingState,
} from "@tanstack/react-table"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { toast } from "sonner"
import { z } from "zod"

import { useIsMobile } from "@/hooks/use-mobile"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  CircleCheckIcon,
  LoaderIcon,
  EllipsisVerticalIcon,
  Columns3Icon,
  ChevronDownIcon,
  PlusIcon,
  TrendingUpIcon,
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
} from "lucide-react"

export const boqItemSchema = z.object({
  id: z.number(),
  code: z.string().optional(),
  header: z.string(),
  name: z.string().optional(),
  type: z.string(),
  category: z.string().optional(),
  status: z.string(),
  action: z.string().optional(),
  unit: z.string().optional(),
  rate: z.number(),
  quantity: z.number(),
  target: z.string().optional(),
  limit: z.string().optional(),
  reviewer: z.string(),
  comments: z.string().optional(),
})

export type BOQTableItem = z.infer<typeof boqItemSchema>

const features = tableFeatures({
  columnFilteringFeature,
  columnVisibilityFeature,
  rowSelectionFeature,
  rowSortingFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
})

const columnHelper = createColumnHelper<typeof features, BOQTableItem>()

// Category color styling tokens
const getCategoryStyle = (typeStr: string) => {
  const t = (typeStr || "").toLowerCase()
  if (t.includes("antenna") || t.includes("rru")) {
    return "bg-sky-500/10 text-sky-400 border-sky-500/25 hover:bg-sky-500/15"
  }
  if (t.includes("power") || t.includes("feeder")) {
    return "bg-amber-500/10 text-amber-400 border-amber-500/25 hover:bg-amber-500/15"
  }
  if (t.includes("struct") || t.includes("mount")) {
    return "bg-indigo-500/10 text-indigo-400 border-indigo-500/25 hover:bg-indigo-500/15"
  }
  if (t.includes("plant") || t.includes("rigging")) {
    return "bg-purple-500/10 text-purple-400 border-purple-500/25 hover:bg-purple-500/15"
  }
  if (t.includes("test") || t.includes("handover")) {
    return "bg-teal-500/10 text-teal-400 border-teal-500/25 hover:bg-teal-500/15"
  }
  if (t.includes("architectural")) {
    return "bg-rose-500/10 text-rose-400 border-rose-500/25 hover:bg-rose-500/15"
  }
  return "bg-muted/70 text-muted-foreground border-border/60"
}

function TableRowItem({
  row,
}: {
  row: Row<typeof features, BOQTableItem>
}) {
  return (
    <TableRow
      data-state={row.getIsSelected() && "selected"}
      className="relative z-0 hover:bg-muted/30 data-[state=selected]:bg-muted/50 transition-colors border-b border-border/70 group"
    >
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id} className="py-3 px-3 first:w-12 first:px-0 first:text-center align-middle">
          <FlexRender cell={cell} />
        </TableCell>
      ))}
    </TableRow>
  )
}

interface BOQDataTableProps {
  initialData: BOQTableItem[]
  pdfName?: string
  viewMode?: 'boq' | 'pricelist'
  onEditItem?: (item: any) => void
  onNavigateToPage?: (page: number) => void
  onExportExcel?: (onlyPriced?: boolean) => void
  onResetEstimates?: () => void
  onAddItem?: () => void
}

export function BOQDataTable({
  initialData,
  pdfName,
  viewMode = 'boq',
  onEditItem,
  onNavigateToPage,
  onExportExcel,
  onResetEstimates,
  onAddItem,
}: BOQDataTableProps) {
  const [data, setData] = React.useState<BOQTableItem[]>(() => initialData)
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [searchQuery, setSearchQuery] = React.useState("")

  // Update data when initialData changes
  React.useEffect(() => {
    if (initialData && initialData.length > 0) {
      setData(initialData)
    }
  }, [initialData])

  const handleQuantityChange = React.useCallback((id: number, valStr: string) => {
    const val = parseFloat(valStr) || 0
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: val, target: valStr } : item))
    )
  }, [])

  const handleDeleteItem = React.useCallback((id: number) => {
    setData((prev) => prev.filter((item) => item.id !== id))
    toast.success("Item removed from BOQ Schedule")
  }, [])

  const columns = React.useMemo(() => {
    return columnHelper.columns([
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <div className="w-12 flex items-center justify-center">
            <Checkbox
              checked={
                table.getIsAllRowsSelected()
                  ? true
                  : table.getIsSomeRowsSelected()
                  ? "indeterminate"
                  : false
              }
              onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
              aria-label="Select all"
              className="size-4 rounded border-border/80"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="w-12 flex items-center justify-center">
            <Checkbox
              checked={row.getIsSelected()}
              onCheckedChange={(value) => row.toggleSelected(!!value)}
              aria-label="Select row"
              className="size-4 rounded border-border/80"
            />
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      }),
      columnHelper.accessor("header", {
        header: "Header",
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex flex-col gap-0.5 max-w-[460px]">
              <BOQDrawerItem item={item} />
              <div className="text-[11px] font-mono text-muted-foreground flex items-center gap-1.5 mt-0.5 transition-colors">
                {item.code && (
                  <span className="font-semibold text-foreground/85 group-hover:text-foreground transition-colors">{item.code}</span>
                )}
                {item.code && <span>•</span>}
                <span>Unit: {item.unit || "EA"}</span>
                <span>•</span>
                <span className="group-hover:text-emerald-400 transition-colors">${item.rate.toFixed(2)}</span>
              </div>
            </div>
          )
        },
        enableHiding: false,
      }),
      columnHelper.accessor("type", {
        header: "Section Type",
        cell: ({ row }) => (
          <div className="w-40">
            <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border truncate block text-center transition-colors ${getCategoryStyle(row.original.type)}`}>
              {row.original.type}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor("status", {
        header: "Status",
        cell: ({ row }) => (
          <div className="w-28">
            {row.original.status === "Done" ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 rounded-full">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Done
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-[11px] font-medium text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full">
                <LoaderIcon className="size-3 text-amber-400 animate-spin" />
                In Process
              </span>
            )}
          </div>
        ),
      }),
      columnHelper.accessor("rate", {
        header: () => <div className="w-24 text-right text-xs font-semibold text-muted-foreground">Rate ($)</div>,
        cell: ({ row }) => (
          <div className="w-24 text-right font-normal tabular-nums text-xs text-foreground/90">
            <span className="text-muted-foreground/60 mr-0.5">$</span>
            {row.original.rate.toFixed(2)}
          </div>
        ),
      }),
      columnHelper.accessor("quantity", {
        header: () => <div className="w-24 text-center text-xs font-semibold text-muted-foreground">Quantity</div>,
        cell: ({ row }) => {
          return (
            <div className="w-24 flex justify-center">
              <input
                type="text"
                defaultValue={row.original.quantity > 0 ? String(row.original.quantity) : ""}
                placeholder="0"
                onChange={(e) => {
                  const val = e.target.value
                  if (val === "" || /^\d*\.?\d*$/.test(val)) {
                    handleQuantityChange(row.original.id, val)
                  }
                }}
                className="h-6.5 w-14 text-center text-[11px] font-normal tabular-nums bg-muted/40 hover:bg-muted/70 focus:bg-background focus:border-primary border border-border/60 rounded-md outline-none transition-all shadow-2xs"
              />
            </div>
          )
        },
      }),
      columnHelper.display({
        id: "totalCost",
        header: () => <div className="w-28 text-right text-xs font-semibold text-muted-foreground">Total Cost</div>,
        cell: ({ row }) => {
          const total = (row.original.rate || 0) * (row.original.quantity || 0)
          return (
            <div className="w-28 text-right font-medium tabular-nums text-xs text-foreground">
              {total > 0 ? (
                <>
                  <span className="text-muted-foreground/60 mr-0.5">$</span>
                  {total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </>
              ) : (
                <span className="text-muted-foreground/40">-</span>
              )}
            </div>
          )
        },
      }),
      columnHelper.display({
        id: "actions",
        header: () => <div className="text-right pr-2">Actions</div>,
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-1 pr-2">
            {onEditItem && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEditItem(row.original)}
                title="Edit Item"
                className="size-7 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
              >
                <PencilIcon className="size-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleDeleteItem(row.original.id)}
              title="Delete Item"
              className="size-7 text-muted-foreground hover:text-destructive rounded-md cursor-pointer"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        ),
      }),
    ])
  }, [handleQuantityChange, handleDeleteItem, onEditItem])

  // Search filter
  const filteredData = React.useMemo(() => {
    let result = data
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          item.header.toLowerCase().includes(q) ||
          (item.code && item.code.toLowerCase().includes(q)) ||
          item.type.toLowerCase().includes(q)
      )
    }
    return result
  }, [data, searchQuery])

  const table = useTable({
    features,
    data: filteredData,
    columns,
    state: {
      sorting,
      columnVisibility,
      rowSelection,
      columnFilters,
    },
    getRowId: (row) => row.id.toString(),
    enableRowSelection: true,
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
  })

  // Real-time KPI Stats
  const stats = React.useMemo(() => {
    let totalCost = 0
    let pricedCount = 0
    data.forEach((item) => {
      const qty = item.quantity || 0
      if (qty > 0) {
        totalCost += (item.rate || 0) * qty
        pricedCount++
      }
    })
    return {
      totalCost,
      pricedCount,
      totalItems: data.length,
    }
  }, [data])

  const handleDeleteSelected = React.useCallback(() => {
    const selectedRows = table.getSelectedRowModel().rows
    const selectedIds = new Set(selectedRows.map((r) => r.original.id))
    setData((prev) => prev.filter((item) => !selectedIds.has(item.id)))
    setRowSelection({})
    toast.success(`Removed ${selectedIds.size} selected items from BOQ Schedule`)
  }, [table])

  return (
    <div className="flex-1 w-full border border-border/80 rounded-xl bg-card flex flex-col min-h-0 overflow-hidden shadow-xs">
      {/* Top Control Toolbar */}
      <div className="p-3.5 px-4.5 border-b border-border/80 bg-muted/20 flex items-center justify-between gap-3 shrink-0">
        <div className="relative w-80 sm:w-96">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by SOR code, equipment name, section..."
            className="h-8.5 pl-8.5 pr-8 text-xs bg-background/90 focus-visible:bg-background border-border/70 rounded-lg shadow-2xs"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground hover:text-foreground cursor-pointer"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {table.getSelectedRowModel().rows.length > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDeleteSelected}
              className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg shadow-2xs font-medium"
            >
              <Trash2Icon className="size-3.5" />
              <span>Delete Selected ({table.getSelectedRowModel().rows.length})</span>
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-8.5 px-3 text-xs gap-1.5 cursor-pointer rounded-lg border-border/70 bg-background/90 shadow-2xs">
                <Columns3Icon className="size-3.5 text-muted-foreground" />
                <span>Columns</span>
                <ChevronDownIcon className="size-3 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36 text-xs">
              {table
                .getAllColumns()
                .filter((column) => typeof column.accessorFn !== "undefined" && column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    className="capitalize text-xs cursor-pointer"
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  >
                    {column.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {onAddItem && (
            <Button size="sm" onClick={onAddItem} className="h-8.5 px-3.5 text-xs gap-1.5 cursor-pointer bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-2xs font-medium">
              <PlusIcon className="size-3.5" />
              <span>Add Item</span>
            </Button>
          )}
        </div>
      </div>

      {/* Scrollable Data Table Container - Firmly fixed table header */}
      <div className="flex-1 overflow-auto min-h-0 relative">
        <table className="w-full caption-bottom text-sm border-collapse">
          <thead className="sticky top-0 z-30 bg-muted/95 backdrop-blur-md border-b border-border/80 shadow-xs">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent border-b border-border/80 bg-muted/95">
                {headerGroup.headers.map((header) => {
                  const canSort = header.column.getCanSort()
                  const isSorted = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      colSpan={header.colSpan}
                      onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                      className={`h-10 px-3 text-left align-middle text-xs font-semibold whitespace-nowrap text-foreground/90 sticky top-0 bg-muted/95 border-b border-border/80 select-none first:w-12 first:px-0 first:text-center group/th ${
                        canSort ? 'cursor-pointer hover:text-foreground hover:bg-muted/90 transition-colors' : ''
                      }`}
                    >
                      {header.isPlaceholder ? null : (
                        <div className={`flex items-center gap-1.5 ${header.id === 'select' ? 'justify-center' : header.id === 'actions' || header.id === 'total' || header.id === 'rate' ? 'justify-end' : 'justify-start'}`}>
                          <FlexRender header={header} />
                          {canSort && (
                            <span className="inline-flex items-center text-muted-foreground/70 group-hover/th:text-foreground">
                              {isSorted === 'asc' ? (
                                <ArrowUpIcon className="size-3 text-primary" />
                              ) : isSorted === 'desc' ? (
                                <ArrowDownIcon className="size-3 text-primary" />
                              ) : (
                                <ArrowUpDownIcon className="size-3 opacity-40 group-hover/th:opacity-100 transition-opacity" />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  )
                })}
              </TableRow>
            ))}
          </thead>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRowItem key={row.id} row={row} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-32 text-center text-muted-foreground text-xs font-medium">
                  No matching BOQ items found for &ldquo;{searchQuery}&rdquo;.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      {/* Clean Bottom Summary Bar */}
      <div className="p-3 px-4.5 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between text-xs select-none shrink-0 gap-2">
        <div className="flex items-center gap-3 text-muted-foreground font-medium">
          <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50 text-[11px]">
            {table.getSelectedRowModel().rows.length} of {table.getRowModel().rows.length} selected
          </span>
          <span className="hidden sm:inline">
            Priced Takeoff: <strong className="text-foreground font-semibold">{stats.pricedCount}</strong> of {stats.totalItems} items
          </span>
        </div>

        <div className="flex items-center gap-4 font-medium">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <span className="text-[11px] text-emerald-400/80 font-normal">Total Estimated Cost:</span>
            <strong className="text-sm font-bold text-emerald-400 tracking-tight">
              ${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </strong>
          </div>
        </div>
      </div>
    </div>
  )
}

const chartData = [
  { month: "Jan", desktop: 186, mobile: 80 },
  { month: "Feb", desktop: 305, mobile: 200 },
  { month: "Mar", desktop: 237, mobile: 120 },
  { month: "Apr", desktop: 173, mobile: 190 },
  { month: "May", desktop: 209, mobile: 130 },
  { month: "Jun", desktop: 284, mobile: 140 },
]

const chartConfig = {
  desktop: {
    label: "Takeoff Cost ($k)",
    color: "var(--primary)",
  },
  mobile: {
    label: "Baseline Rate",
    color: "var(--primary)",
  },
} satisfies ChartConfig

function BOQDrawerItem({
  item,
}: {
  item: BOQTableItem
}) {
  const isMobile = useIsMobile()

  return (
    <Drawer direction={isMobile ? "bottom" : "right"}>
      <DrawerTrigger asChild>
        <Button variant="link" className="w-fit px-0 text-left text-foreground group-hover:text-primary text-xs font-semibold hover:underline p-0 h-auto transition-colors duration-150 cursor-pointer justify-start no-underline">
          <span className="truncate max-w-[420px] text-left">{item.header}</span>
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-w-xl">
        <DrawerHeader className="gap-1.5 pb-2">
          <DrawerTitle className="text-base font-bold flex items-center gap-2">
            {item.code && (
              <span className="font-mono text-xs px-2 py-0.5 bg-muted rounded-md font-semibold border border-border/60">
                {item.code}
              </span>
            )}
            <span>{item.header}</span>
          </DrawerTitle>
          <DrawerDescription className="text-xs">
            Section: {item.type} • Status: {item.status} • Unit Rate: ${item.rate.toFixed(2)} / {item.unit || "EA"}
          </DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 text-xs">
          {!isMobile && (
            <>
              <ChartContainer config={chartConfig} className="h-44 w-full">
                <AreaChart
                  accessibilityLayer
                  data={chartData}
                  margin={{
                    left: 0,
                    right: 10,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tickFormatter={(value) => value.slice(0, 3)}
                    hide
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                  />
                  <Area
                    dataKey="mobile"
                    type="natural"
                    fill="var(--color-mobile)"
                    fillOpacity={0.6}
                    stroke="var(--color-mobile)"
                    stackId="a"
                  />
                  <Area
                    dataKey="desktop"
                    type="natural"
                    fill="var(--color-desktop)"
                    fillOpacity={0.4}
                    stroke="var(--color-desktop)"
                    stackId="a"
                  />
                </AreaChart>
              </ChartContainer>
              <Separator />
              <div className="grid gap-1.5">
                <div className="flex items-center gap-2 leading-none font-semibold text-foreground text-xs">
                  Rate Analysis Trend
                  <TrendingUpIcon className="size-3.5 text-emerald-500" />
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  Scheduled takeoff item matched via Schedule of Rates item specification.
                </div>
              </div>
              <Separator />
            </>
          )}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Item Description</Label>
              <Input className="text-xs h-8" defaultValue={item.header} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Rate ($)</Label>
                <Input className="text-xs h-8" defaultValue={String(item.rate)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Quantity</Label>
                <Input className="text-xs h-8" defaultValue={String(item.quantity)} />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Notes / Comments</Label>
              <Input className="text-xs h-8" defaultValue={item.comments || "Standard extraction verification"} />
            </div>
          </div>
        </div>
        <DrawerFooter className="flex flex-row justify-end gap-2 pt-4">
          <DrawerClose asChild>
            <Button size="sm" className="text-xs">Save & Close</Button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
