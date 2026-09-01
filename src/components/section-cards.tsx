import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TrendingUpIcon,
  LayersIcon,
  CheckCircle2Icon,
  CpuIcon,
  FileSpreadsheetIcon,
} from "lucide-react"

export function SectionCards() {
  return (
    <div className="grid grid-cols-1 gap-4 px-0 lg:grid-cols-2 xl:grid-cols-4">
      <Card className="@container/card shadow-xs border-border/80">
        <CardHeader>
          <CardDescription className="text-xs font-medium">Total BOQ Valuation</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums @[250px]/card:text-3xl">
            $1,842,500
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
              <TrendingUpIcon className="size-3 mr-1" />
              +8.4% vs Budget
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <FileSpreadsheetIcon className="size-3.5 text-primary" />
            <span>Active Project State</span>
          </div>
          <div className="text-muted-foreground">
            Across 6 trade packages & specifications
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card shadow-xs border-border/80">
        <CardHeader>
          <CardDescription className="text-xs font-medium">Extracted Line Items</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums @[250px]/card:text-3xl">
            1,428
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-medium">
              <LayersIcon className="size-3 mr-1" />
              12 Sheets
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <LayersIcon className="size-3.5 text-primary" />
            <span>Multi-page Takeoffs</span>
          </div>
          <div className="text-muted-foreground">
            Sample_Office_BOQ & Specs processed
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card shadow-xs border-border/80">
        <CardHeader>
          <CardDescription className="text-xs font-medium">AI Takeoff Accuracy</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums @[250px]/card:text-3xl">
            98.4%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-medium">
              <CheckCircle2Icon className="size-3 mr-1" />
              High Confidence
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <CheckCircle2Icon className="size-3.5 text-emerald-500" />
            <span>Auto-Verified Extraction</span>
          </div>
          <div className="text-muted-foreground">
            Zero bounding-box misalignment
          </div>
        </CardFooter>
      </Card>

      <Card className="@container/card shadow-xs border-border/80">
        <CardHeader>
          <CardDescription className="text-xs font-medium">Master Price Catalog Match</CardDescription>
          <CardTitle className="text-2xl font-bold tracking-tight text-foreground tabular-nums @[250px]/card:text-3xl">
            94.2%
          </CardTitle>
          <CardAction>
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-medium">
              <CpuIcon className="size-3 mr-1" />
              1,345 Mapped
            </Badge>
          </CardAction>
        </CardHeader>
        <CardFooter className="flex-col items-start gap-1 text-xs">
          <div className="flex items-center gap-1.5 font-medium text-foreground">
            <CpuIcon className="size-3.5 text-blue-500" />
            <span>Equipment & Price Sync</span>
          </div>
          <div className="text-muted-foreground">
            83 items pending manual rate review
          </div>
        </CardFooter>
      </Card>
    </div>
  )
}

