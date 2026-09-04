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
import { toast } from "sonner"
import { z } from "zod"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { Textarea } from "@/components/ui/textarea"
import {
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table"
import {
  Columns3Icon,
  ChevronDownIcon,
  PlusIcon,
  SearchIcon,
  PencilIcon,
  Trash2Icon,
  XIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  CheckIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { ItemProvenanceDrawer } from "./ItemProvenanceDrawer"

export const boqItemSchema = z.object({
  id: z.number(),
  row_idx: z.number().optional(),
  code: z.string().optional(),
  header: z.string(),
  name: z.string().optional(),
  type: z.string().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  action: z.string().optional(),
  unit: z.string().optional(),
  rate: z.number(),
  quantity: z.number(),
  target: z.string().optional(),
  limit: z.string().optional(),
  reviewer: z.string().optional(),
  comments: z.string().optional(),
  confidence_score: z.number().optional(),
  confidence_level: z.string().optional(),
  source_sheet: z.string().optional(),
  source_table: z.string().optional(),
  evidence_json: z.any().optional(),
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

export interface BOQDataTableRef {
  openAddItem: () => void
  openEditItem: (item: BOQTableItem) => void
  openProvenanceItem?: (item: BOQTableItem) => void
}

interface BOQDataTableProps {
  initialData: BOQTableItem[]
  loading?: boolean
  pdfName?: string
  viewMode?: 'boq' | 'pricelist'
  activePriceListId?: string
  onEditItem?: (item: any) => void
  onNavigateToPage?: (page: number) => void
  onExportExcel?: (onlyPriced?: boolean) => void
  onResetEstimates?: () => void
  onAddItem?: () => void
  onReload?: () => void
}

export const BOQDataTable = React.forwardRef<BOQDataTableRef, BOQDataTableProps>(({
  initialData,
  loading = false,
  pdfName,
  viewMode = 'boq',
  activePriceListId,
  onEditItem,
  onNavigateToPage,
  onExportExcel,
  onResetEstimates,
  onAddItem,
  onReload,
}, ref) => {
  const [data, setData] = React.useState<BOQTableItem[]>(() => initialData || [])
  const [prevInitialData, setPrevInitialData] = React.useState(initialData)

  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData)
    setData(initialData || [])
  }
  const [rowSelection, setRowSelection] = React.useState({})
  const [columnVisibility, setColumnVisibility] = React.useState<ColumnVisibilityState>({})
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [searchQuery, setSearchQuery] = React.useState("")

  const [drawerOpen, setDrawerOpen] = React.useState(false)
  const [drawerMode, setDrawerMode] = React.useState<'add' | 'edit'>('edit')
  const [drawerItem, setDrawerItem] = React.useState<BOQTableItem | null>(null)

  const [provenanceDrawerOpen, setProvenanceDrawerOpen] = React.useState(false)
  const [selectedProvenanceItem, setSelectedProvenanceItem] = React.useState<BOQTableItem | null>(null)

  const handleOpenProvenanceDrawer = React.useCallback((item: BOQTableItem) => {
    setSelectedProvenanceItem(item)
    setProvenanceDrawerOpen(true)
  }, [])

  const [formCode, setFormCode] = React.useState('')
  const [formName, setFormName] = React.useState('')
  const [formUnit, setFormUnit] = React.useState('')
  const [formRate, setFormRate] = React.useState('')
  const [formQuantity, setFormQuantity] = React.useState('0')
  const [formCategory, setFormCategory] = React.useState('')
  const [formComments, setFormComments] = React.useState('')
  const [isCustomUnit, setIsCustomUnit] = React.useState(false)
  const [isCustomCategory, setIsCustomCategory] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Dynamically compute existing categories & units strictly from active Excel / database items (0 hardcoded lists)
  const existingCategories = React.useMemo(() => {
    const cats = new Set<string>()
    data.forEach((it) => {
      const c = (it.category || it.type || '').trim()
      if (c) cats.add(c)
    })
    return Array.from(cats).sort()
  }, [data])

  const existingUnits = React.useMemo(() => {
    const units = new Set<string>()
    data.forEach((it) => {
      const u = (it.unit || '').trim()
      if (u) units.add(u)
    })
    return Array.from(units).sort()
  }, [data])

  const handleOpenAddDrawer = React.useCallback(() => {
    setDrawerMode('add')
    setDrawerItem(null)
    setFormCode('')
    setFormName('')
    setFormUnit(existingUnits[0] || '')
    setFormRate('')
    setFormQuantity('0')
    setFormCategory(existingCategories[0] || '')
    setFormComments('')
    setIsCustomUnit(existingUnits.length === 0)
    setIsCustomCategory(existingCategories.length === 0)
    setDrawerOpen(true)
  }, [existingCategories, existingUnits])

  const handleOpenEditDrawer = React.useCallback((item: BOQTableItem) => {
    setDrawerMode('edit')
    setDrawerItem(item)
    setFormCode(item.code || '')
    setFormName(item.name || item.header || '')
    setFormUnit(item.unit || '')
    setFormRate(String(item.rate ?? ''))
    setFormQuantity(String(item.quantity ?? '0'))
    setFormCategory(item.category || item.type || '')
    setFormComments(item.comments || '')
    setIsCustomUnit(false)
    setIsCustomCategory(false)
    setDrawerOpen(true)
  }, [])

  React.useImperativeHandle(ref, () => ({
    openAddItem: handleOpenAddDrawer,
    openEditItem: handleOpenEditDrawer,
    openProvenanceItem: handleOpenProvenanceDrawer,
  }), [handleOpenAddDrawer, handleOpenEditDrawer, handleOpenProvenanceDrawer])

  const handleSaveDrawer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmedName = formName.trim()
    if (!trimmedName) {
      toast.error('Item Description is required')
      return
    }
    const rateNum = parseFloat(formRate)
    if (isNaN(rateNum) || rateNum < 0) {
      toast.error('Please enter a valid positive rate')
      return
    }
    const qtyNum = parseFloat(formQuantity) || 0
    const finalUnit = formUnit.trim() || 'each'
    const finalCat = formCategory.trim() || 'General SOR Pricing Items'

    setSaving(true)
    try {
      if (drawerMode === 'add') {
        const payload = {
          code: formCode.trim(),
          name: trimmedName,
          unit: finalUnit,
          rate: rateNum,
          category: finalCat,
        }
        const res = await fetch(`http://localhost:8000/api/price-list?price_list_id=${activePriceListId || 1}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to create item')
        toast.success('New catalog item created!')
        onReload?.()
      } else if (drawerItem) {
        const payload = {
          code: formCode.trim(),
          name: trimmedName,
          unit: finalUnit,
          rate: rateNum,
          category: finalCat,
        }
        const res = await fetch(`http://localhost:8000/api/price-list/${drawerItem.id}?price_list_id=${activePriceListId || 1}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update item')
        
        setData((prev) =>
          prev.map((it) =>
            it.id === drawerItem.id
              ? {
                  ...it,
                  code: formCode.trim(),
                  name: trimmedName,
                  header: trimmedName,
                  unit: finalUnit,
                  rate: rateNum,
                  quantity: qtyNum,
                  category: finalCat,
                  type: finalCat,
                  comments: formComments,
                }
              : it
          )
        )
        toast.success('Item updated successfully!')
        onReload?.()
      }
      setDrawerOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save item')
    } finally {
      setSaving(false)
    }
  }

  React.useEffect(() => {
    setData(initialData || [])
    setRowSelection({})
  }, [initialData])

  const handleQuantityChange = React.useCallback((id: number, valStr: string) => {
    const val = parseFloat(valStr) || 0
    setData((prev) =>
      prev.map((item) => (item.id === id ? { ...item, quantity: val, target: valStr } : item))
    )
  }, [])

  const handleDeleteItem = React.useCallback(async (id: number) => {
    const idNum = Number(id)
    setData((prev) => prev.filter((item) => item.id !== idNum))
    try {
      if (viewMode === 'pricelist') {
        const res = await fetch(`http://localhost:8000/api/price-list/${idNum}?price_list_id=${activePriceListId || 1}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Delete failed')
      }
      toast.success("Item deleted from database")
      onReload?.()
    } catch (e) {
      toast.error("Failed to delete item from database")
    }
  }, [viewMode, activePriceListId, onReload])

  const handleDeleteSelected = React.useCallback(async () => {
    const selectedIds = Object.keys(rowSelection)
      .map((k) => parseInt(k, 10))
      .filter((n) => !isNaN(n))

    if (selectedIds.length === 0) return

    const idSet = new Set(selectedIds)
    setData((prev) => prev.filter((item) => !idSet.has(item.id)))
    setRowSelection({})

    try {
      if (viewMode === 'pricelist') {
        const res = await fetch(`http://localhost:8000/api/price-list/delete-batch?price_list_id=${activePriceListId || 1}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ row_indices: selectedIds }),
        })
        if (!res.ok) throw new Error('Batch delete failed')
      }
      toast.success(`Deleted ${selectedIds.length} item(s) from database`)
      onReload?.()
    } catch (e) {
      toast.error("Failed to delete selected items from database")
    }
  }, [rowSelection, viewMode, activePriceListId, onReload])

  const columns = React.useMemo(() => {
    if (viewMode === 'pricelist') {
      return columnHelper.columns([
        columnHelper.display({
          id: "select",
          header: ({ table }) => (
            <div className="w-10 flex items-center justify-center">
              <Checkbox
                checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
                onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
                aria-label="Select all"
                className="size-4 rounded border-border/80"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div className="w-10 flex items-center justify-center">
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
        columnHelper.accessor("code", {
          header: () => <div className="w-28 text-xs font-semibold text-muted-foreground">SOR Code</div>,
          cell: ({ row }) => <div className="w-28 font-mono text-xs font-semibold text-primary">{row.original.code || "—"}</div>,
        }),
        columnHelper.accessor("header", {
          header: () => <div className="text-xs font-semibold text-muted-foreground">Item Description</div>,
          cell: ({ row }) => {
            const item = row.original
            return (
              <div className="flex flex-col gap-0.5 max-w-[540px]">
                <button
                  type="button"
                  onClick={() => handleOpenEditDrawer(item)}
                  className="w-fit text-left text-foreground hover:text-primary text-xs font-semibold hover:underline p-0 h-auto transition-colors duration-150 cursor-pointer justify-start no-underline truncate max-w-[420px]"
                >
                  {item.header}
                </button>
              </div>
            )
          },
          enableHiding: false,
        }),
        columnHelper.accessor("unit", {
          header: () => <div className="w-20 text-center text-xs font-semibold text-muted-foreground">Unit</div>,
          cell: ({ row }) => (
            <div className="w-20 text-center font-mono text-xs font-medium text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60">{row.original.unit || "EA"}</span>
            </div>
          ),
        }),
        columnHelper.accessor("rate", {
          header: () => <div className="w-28 text-right text-xs font-semibold text-muted-foreground">Rate ($ Excl. GST)</div>,
          cell: ({ row }) => (
            <div className="w-28 text-right font-medium tabular-nums text-xs text-foreground">
              <span className="text-muted-foreground/60 mr-0.5">$</span>
              {row.original.rate.toFixed(2)}
            </div>
          ),
        }),
        columnHelper.accessor("type", {
          header: () => <div className="w-36 text-center text-xs font-semibold text-muted-foreground">Category / Section</div>,
          cell: ({ row }) => (
            <div className="w-36 flex justify-center">
              <span className={`px-2.5 py-0.5 text-[11px] font-medium rounded-full border truncate max-w-[140px] text-center transition-colors ${getCategoryStyle(row.original.type || '')}`}>
                {row.original.type || ''}
              </span>
            </div>
          ),
        }),
        columnHelper.display({
          id: "actions",
          header: () => <div className="text-right text-xs font-semibold text-muted-foreground pr-2">Actions</div>,
          cell: ({ row }) => (
            <div className="flex items-center justify-end gap-1 pr-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleOpenEditDrawer(row.original)}
                className="size-7 cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted"
                title="Edit Item"
              >
                <PencilIcon className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDeleteItem(row.original.id)}
                className="size-7 cursor-pointer text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Delete Item"
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            </div>
          ),
        }),
      ])
    }

    return columnHelper.columns([
      columnHelper.display({
        id: "select",
        header: ({ table }) => (
          <div className="w-10 flex items-center justify-center">
            <Checkbox
              checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
              onCheckedChange={(value) => table.toggleAllRowsSelected(!!value)}
              aria-label="Select all"
              className="size-4 rounded border-border/80"
            />
          </div>
        ),
        cell: ({ row }) => (
          <div className="w-10 flex items-center justify-center">
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
      columnHelper.accessor("code", {
        header: () => <div className="w-24 text-xs font-semibold text-muted-foreground">SOR Code</div>,
        cell: ({ row }) => <div className="w-24 font-mono text-xs font-semibold text-primary">{row.original.code || "—"}</div>,
      }),
      columnHelper.accessor("header", {
        header: () => <div className="text-xs font-semibold text-muted-foreground">Item Description</div>,
        cell: ({ row }) => {
          const item = row.original
          return (
            <div className="flex flex-col gap-0.5 max-w-[420px]">
              <button
                type="button"
                onClick={() => handleOpenProvenanceDrawer(item)}
                className="w-fit text-left text-foreground hover:text-primary text-xs font-semibold hover:underline p-0 h-auto transition-colors duration-150 cursor-pointer justify-start no-underline truncate max-w-[420px]"
                title="Click to view mapped constituent facts, sources & duplicate items"
              >
                {item.header}
              </button>
            </div>
          )
        },
        enableHiding: false,
      }),
      columnHelper.accessor("unit", {
        header: () => <div className="w-16 text-center text-xs font-semibold text-muted-foreground">Unit</div>,
        cell: ({ row }) => (
          <div className="w-16 text-center font-mono text-xs font-medium text-muted-foreground">
            <span className="px-2 py-0.5 rounded bg-muted/60 border border-border/60">{row.original.unit || "EA"}</span>
          </div>
        ),
      }),
      columnHelper.accessor("rate", {
        header: () => <div className="w-24 text-right text-xs font-semibold text-muted-foreground">Unit Rate</div>,
        cell: ({ row }) => (
          <div className="w-24 text-right font-medium tabular-nums text-xs text-foreground">
            <span className="text-muted-foreground/60 mr-0.5">$</span>
            {row.original.rate.toFixed(2)}
          </div>
        ),
      }),
      columnHelper.accessor("quantity", {
        header: () => <div className="w-28 text-center text-xs font-semibold text-muted-foreground">Qty</div>,
        cell: ({ row }) => (
          <div className="w-28 flex items-center justify-center">
            <Input
              type="number"
              min="0"
              step="any"
              defaultValue={row.original.quantity || ""}
              placeholder="0"
              onBlur={(e) => handleQuantityChange(row.original.id, e.target.value)}
              className="h-7 w-20 text-center text-xs font-mono bg-background border-border/70 focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
            />
          </div>
        ),
      }),
      columnHelper.display({
        id: "total_cost",
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenProvenanceDrawer(row.original)}
              title="View Mapped Items & Provenance"
              className="size-7 text-muted-foreground hover:text-primary rounded-md cursor-pointer"
            >
              <ExternalLinkIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleOpenEditDrawer(row.original)}
              title="Edit Item"
              className="size-7 text-muted-foreground hover:text-foreground rounded-md cursor-pointer"
            >
              <PencilIcon className="size-3.5" />
            </Button>
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
  }, [viewMode, handleQuantityChange, handleDeleteItem, handleOpenEditDrawer])

  const filteredData = React.useMemo(() => {
    let result = data
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      result = result.filter(
        (item) =>
          (item.code && item.code.toLowerCase().includes(q)) ||
          item.header.toLowerCase().includes(q) ||
          (item.category && item.category.toLowerCase().includes(q)) ||
          (item.type && item.type.toLowerCase().includes(q)) ||
          (item.comments && item.comments.toLowerCase().includes(q))
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

  const stats = React.useMemo(() => {
    const totalItems = data.length
    const pricedCount = data.filter((d) => (d.quantity || 0) > 0).length
    const totalCost = data.reduce((sum, d) => sum + (d.rate || 0) * (d.quantity || 0), 0)
    return { totalItems, pricedCount, totalCost }
  }, [data])

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 bg-card rounded-xl border border-border shadow-xs overflow-hidden">
      <div className="p-3.5 border-b border-border/80 flex flex-col sm:flex-row gap-2.5 items-center justify-between bg-muted/20 select-none shrink-0">
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search code, description, or section..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8.5 text-xs rounded-lg border-border/70 bg-background/90 focus-visible:ring-1 focus-visible:ring-primary shadow-2xs"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery("")}
              className="h-8.5 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Clear
            </Button>
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
        </div>
      </div>

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
                      className="h-10 px-3 text-left align-middle font-semibold text-xs text-muted-foreground select-none whitespace-nowrap first:w-10 first:px-0 first:text-center"
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <div
                          className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors group"
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          <FlexRender header={header} />
                          {isSorted === "asc" ? (
                            <ArrowUpIcon className="size-3 text-primary" />
                          ) : isSorted === "desc" ? (
                            <ArrowDownIcon className="size-3 text-primary" />
                          ) : (
                            <ArrowUpDownIcon className="size-3 opacity-0 group-hover:opacity-40 transition-opacity" />
                          )}
                        </div>
                      ) : (
                        <FlexRender header={header} />
                      )}
                    </th>
                  )
                })}
              </TableRow>
            ))}
          </thead>
          <TableBody>
            {loading || (data.length === 0 && initialData && initialData.length > 0) ? (
              Array.from({ length: 8 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`} className="border-b border-border/50">
                  {viewMode === 'pricelist' ? (
                    <>
                      <TableCell className="py-3 px-0 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell className="py-3 px-3 text-center"><Skeleton className="h-5 w-10 mx-auto rounded" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="py-3 px-3 text-center"><Skeleton className="h-5 w-24 mx-auto rounded-full" /></TableCell>
                      <TableCell className="py-3 px-3 text-right"><Skeleton className="h-6 w-12 ml-auto rounded" /></TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="py-3 px-0 text-center"><Skeleton className="h-4 w-4 mx-auto rounded" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-16" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-64" /></TableCell>
                      <TableCell className="py-3 px-3 text-center"><Skeleton className="h-5 w-10 mx-auto rounded" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="py-3 px-3 text-center"><Skeleton className="h-6 w-16 mx-auto rounded" /></TableCell>
                      <TableCell className="py-3 px-3"><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                      <TableCell className="py-3 px-3 text-right"><Skeleton className="h-6 w-12 ml-auto rounded" /></TableCell>
                    </>
                  )}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRowItem key={row.id} row={row} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center text-muted-foreground text-xs font-medium">
                  {searchQuery ? (
                    <>No matching items found for &ldquo;{searchQuery}&rdquo;.</>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 py-6">
                      <p className="text-sm font-semibold text-foreground/80">No items in this price catalog</p>
                      <p className="text-xs text-muted-foreground max-w-sm">
                        Import an Excel spreadsheet or click below to add a new rate item.
                      </p>
                      <Button
                        size="sm"
                        onClick={handleOpenAddDrawer}
                        className="mt-1 h-8 text-xs gap-1.5 cursor-pointer bg-primary text-primary-foreground font-medium rounded-lg"
                      >
                        <PlusIcon className="size-3.5" />
                        <span>Add First Item</span>
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </table>
      </div>

      <div className="p-3 px-4.5 border-t border-border/80 bg-muted/20 flex flex-col sm:flex-row items-center justify-between text-xs select-none shrink-0 gap-2">
        <div className="flex items-center gap-3 text-muted-foreground font-medium">
          <span className="px-2 py-0.5 rounded-md bg-muted/60 text-muted-foreground border border-border/50 text-[11px]">
            {table.getSelectedRowModel().rows.length} of {table.getRowModel().rows.length} selected
          </span>
          <span>
            {viewMode === 'pricelist' ? (
              <>
                Total Catalog Items: <strong className="text-foreground font-semibold">{stats.totalItems}</strong>
              </>
            ) : (
              <>
                Priced Takeoff: <strong className="text-foreground font-semibold">{stats.pricedCount}</strong> of {stats.totalItems} items
              </>
            )}
          </span>
        </div>
        {viewMode === 'boq' && (
          <div className="flex items-center gap-4 font-medium">
            <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <span className="text-[11px] text-emerald-400/80 font-normal">Total Estimated Cost:</span>
              <strong className="text-sm font-bold text-emerald-400 tracking-tight">
                ${stats.totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </strong>
            </div>
          </div>
        )}
      </div>

      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} direction="right">
        <DrawerContent className="max-w-xl max-h-screen h-full flex flex-col p-0 bg-background border-l border-border shadow-2xl">
          <DrawerHeader className="p-5 pb-4 border-b border-border/80">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <DrawerTitle className="text-base font-bold flex items-center gap-2 flex-wrap">
                  {drawerMode === 'add' ? (
                    <span>Add New SOR Item</span>
                  ) : (
                    <>
                      <span>Edit SOR Item</span>
                      {formCode && (
                        <span className="font-mono text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-md font-semibold border border-primary/25">
                          {formCode}
                        </span>
                      )}
                    </>
                  )}
                </DrawerTitle>
                <DrawerDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed line-clamp-2">
                  {drawerMode === 'add'
                    ? 'Create a new schedule rate item in the master catalog.'
                    : formName || 'Update item specifications and rate.'}
                </DrawerDescription>
              </div>
              <DrawerClose asChild>
                <Button variant="ghost" size="icon" className="size-7 shrink-0 rounded-md text-muted-foreground hover:text-foreground cursor-pointer -mt-0.5">
                  <XIcon className="size-4" />
                </Button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <form onSubmit={handleSaveDrawer} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4 text-xs">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-semibold text-foreground">
                  Item Description <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Supply and install 48-port ODF rack mount enclosure"
                  className="text-xs min-h-[75px] resize-y leading-relaxed font-sans"
                  required
                  autoFocus={drawerMode === 'add'}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-foreground">SOR Code</Label>
                  <Input
                    type="text"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder="e.g. W13327"
                    className="text-xs h-9 font-mono"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Rate ($ Excl. GST) <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formRate}
                    onChange={(e) => setFormRate(e.target.value)}
                    placeholder="e.g. 1147.50"
                    className="text-xs h-9 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Unit</Label>
                    <button
                      type="button"
                      onClick={() => setIsCustomUnit(!isCustomUnit)}
                      className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      {isCustomUnit ? 'Select list' : '+ Custom'}
                    </button>
                  </div>
                  {isCustomUnit || existingUnits.length === 0 ? (
                    <Input
                      type="text"
                      value={formUnit}
                      onChange={(e) => setFormUnit(e.target.value)}
                      placeholder="e.g. each, m, Per 6 Lm..."
                      className="text-xs h-9"
                    />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 text-xs w-full justify-between font-normal px-2.5 bg-background border-border hover:bg-muted cursor-pointer"
                        >
                          <span className="truncate">{formUnit || 'Select unit...'}</span>
                          <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="w-56 max-h-52 overflow-y-auto text-xs p-1">
                        {Array.from(new Set([...existingUnits, formUnit])).filter(Boolean).map((u) => (
                          <DropdownMenuItem
                            key={u}
                            onClick={() => setFormUnit(u)}
                            className="text-xs cursor-pointer justify-between py-1.5 px-2"
                          >
                            <span>{u}</span>
                            {formUnit === u && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold text-foreground">Category / Section</Label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[10px] text-primary hover:underline cursor-pointer font-medium"
                    >
                      {isCustomCategory ? 'Select list' : '+ Custom'}
                    </button>
                  </div>
                  {isCustomCategory || existingCategories.length === 0 ? (
                    <Input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="Enter category name..."
                      className="text-xs h-9"
                    />
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 text-xs w-full justify-between font-normal px-2.5 bg-background border-border hover:bg-muted cursor-pointer"
                        >
                          <span className="truncate">{formCategory || 'Select category...'}</span>
                          <ChevronDownIcon className="size-3.5 text-muted-foreground shrink-0 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" side="bottom" sideOffset={4} className="w-72 max-h-56 overflow-y-auto text-xs p-1">
                        {Array.from(new Set([...existingCategories, formCategory])).filter(Boolean).map((c) => (
                          <DropdownMenuItem
                            key={c}
                            onClick={() => setFormCategory(c)}
                            className="text-xs cursor-pointer justify-between py-1.5 px-2"
                          >
                            <span className="truncate">{c}</span>
                            {formCategory === c && <CheckIcon className="size-3.5 text-primary shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {viewMode === 'boq' && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground">Quantity</Label>
                    <Input
                      type="number"
                      step="any"
                      value={formQuantity}
                      onChange={(e) => setFormQuantity(e.target.value)}
                      placeholder="0"
                      className="text-xs h-9 font-mono"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs font-semibold text-foreground">Notes / Comments</Label>
                    <Input
                      type="text"
                      value={formComments}
                      onChange={(e) => setFormComments(e.target.value)}
                      placeholder="Optional notes..."
                      className="text-xs h-9"
                    />
                  </div>
                </div>
              )}
            </div>

            <DrawerFooter className="p-4 border-t border-border/80 flex flex-row items-center justify-end gap-2 shrink-0 bg-muted/20">
              <DrawerClose asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs h-8.5 px-3.5 cursor-pointer">
                  Cancel
                </Button>
              </DrawerClose>
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="text-xs h-8.5 px-4 cursor-pointer bg-primary text-primary-foreground font-semibold rounded-lg shadow-2xs hover:bg-primary/90"
              >
                {saving ? 'Saving...' : drawerMode === 'add' ? 'Create Item' : 'Save & Close'}
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>

      <ItemProvenanceDrawer
        isOpen={provenanceDrawerOpen}
        onClose={() => setProvenanceDrawerOpen(false)}
        item={selectedProvenanceItem}
        onNavigateToPage={onNavigateToPage}
      />
    </div>
  )
})
BOQDataTable.displayName = "BOQDataTable"
