import React, { memo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TableRow, TableCell } from '@/components/ui/table';
import {
  PencilIcon,
  Trash2Icon,
  ExternalLinkIcon,
  GripVerticalIcon,
  CircleCheckIcon,
  LoaderIcon,
  EllipsisVerticalIcon,
} from 'lucide-react';
import type { PriceListItem } from './UniversViewer';

interface BOQTableRowProps {
  item: PriceListItem;
  categoryName: string;
  viewMode: 'boq' | 'pricelist';
  hasActiveProject: boolean;
  isSelected: boolean;
  quantityValue: string;
  commentValue: string;
  isSaving: boolean;
  onToggleSelectRow: (rowIdx: number) => void;
  onSelectProvenance: (item: PriceListItem) => void;
  onEditItem?: (item: PriceListItem) => void;
  onDeleteItem: (item: PriceListItem) => void;
  onQuantityChange: (rowIdx: number, val: string) => void;
  onCommentChange: (rowIdx: number, val: string) => void;
}

export const BOQTableRow: React.FC<BOQTableRowProps> = memo(({
  item,
  categoryName,
  viewMode,
  hasActiveProject,
  isSelected,
  quantityValue,
  commentValue,
  isSaving,
  onToggleSelectRow,
  onSelectProvenance,
  onEditItem,
  onDeleteItem,
  onQuantityChange,
  onCommentChange,
}) => {
  const [localQty, setLocalQty] = useState(quantityValue);

  useEffect(() => {
    setLocalQty(quantityValue);
  }, [quantityValue]);

  const qty = parseFloat(localQty) || 0;
  const total = item.rate * qty;
  const isDone = item.confidence_level === 'HIGH' || item.confidence_score === undefined || item.confidence_score >= 70;

  const handleQtyBlurOrSubmit = (val: string) => {
    if (val !== quantityValue) {
      onQuantityChange(item.row_idx, val);
    }
  };

  return (
    <TableRow
      className={`h-11 border-b border-border/40 hover:bg-muted/40 transition-colors group ${
        isSelected ? 'bg-primary/5' : ''
      }`}
    >
      {/* Drag Handle */}
      <TableCell className="w-8 px-1 text-center">
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground/60 hover:text-muted-foreground hover:bg-transparent cursor-grab active:cursor-grabbing"
        >
          <GripVerticalIcon className="size-3" />
          <span className="sr-only">Drag</span>
        </Button>
      </TableCell>

      {/* Checkbox */}
      <TableCell className="w-8 px-2 text-center">
        <div className="flex items-center justify-center">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelectRow(item.row_idx)}
            aria-label="Select row"
          />
        </div>
      </TableCell>

      {/* Header (SOR Code + Description) */}
      <TableCell className="font-medium text-foreground py-1.5">
        <div className="flex items-center gap-2 max-w-[450px]">
          {item.code && item.code !== 'UNQUOTED' ? (
            <span className="font-mono text-xs text-muted-foreground font-semibold shrink-0">
              {item.code}
            </span>
          ) : item.code === 'UNQUOTED' ? (
            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 font-bold tracking-wider shrink-0 uppercase">
              UNQUOTED
            </Badge>
          ) : null}
          <span
            className="truncate text-xs font-medium hover:underline cursor-pointer text-foreground"
            onClick={() => onSelectProvenance({
              ...item,
              quantity: localQty !== '' ? parseFloat(localQty) || 0 : item.quantity
            })}
            title={item.name}
          >
            {item.name}
          </span>
        </div>
      </TableCell>

      {/* Section Type */}
      <TableCell className="w-36 py-1.5">
        <Badge
          variant="outline"
          className="px-2.5 py-0.5 text-xs text-muted-foreground font-normal rounded-full max-w-[140px] truncate block text-center"
          title={categoryName}
        >
          {categoryName}
        </Badge>
      </TableCell>

      {/* Status */}
      <TableCell className="w-28 py-1.5">
        <Badge
          variant="outline"
          className="px-2.5 py-0.5 text-xs text-muted-foreground font-normal rounded-full gap-1.5 inline-flex items-center"
        >
          {isDone ? (
            <>
              <CircleCheckIcon className="size-3 fill-green-500 text-background dark:fill-green-400" />
              <span>Done</span>
            </>
          ) : (
            <>
              <LoaderIcon className="size-3 text-amber-500 animate-spin" />
              <span>In Process</span>
            </>
          )}
        </Badge>
      </TableCell>

      {/* Rate */}
      <TableCell className="w-24 text-right font-medium tabular-nums text-xs text-foreground py-1.5">
        ${item.rate.toFixed(2)}
      </TableCell>

      {/* Quantity & Total & Comments */}
      {viewMode !== 'pricelist' && (
        <>
          <TableCell className="w-20 text-right font-medium tabular-nums text-xs text-foreground py-1.5">
            <div className="relative inline-flex items-center justify-end">
              <Input
                type="text"
                value={localQty}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || /^\d*\.?\d*$/.test(val)) {
                    setLocalQty(val);
                    onQuantityChange(item.row_idx, val);
                  }
                }}
                onBlur={() => handleQtyBlurOrSubmit(localQty)}
                disabled={!hasActiveProject}
                className="h-7 w-14 border-transparent bg-transparent text-right text-xs font-semibold tabular-nums shadow-none hover:bg-input/30 focus-visible:border focus-visible:bg-background ml-auto"
                placeholder="0"
              />
              {isSaving && (
                <div className="absolute -left-4 top-1/2 -translate-y-1/2 flex items-center">
                  <div className="size-2.5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </TableCell>

          {/* Total Cost */}
          <TableCell className="w-28 text-right font-medium tabular-nums text-xs text-foreground py-1.5">
            {total > 0 ? (
              `$${total.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`
            ) : (
              '-'
            )}
          </TableCell>

          {/* Reviewer / Comments */}
          <TableCell className="min-w-[160px] max-w-[240px] text-xs text-muted-foreground py-1.5">
            <div className="flex items-center gap-1.5">
              <span className="truncate" title={commentValue || 'Lead Estimator'}>
                {commentValue || 'Lead Estimator'}
              </span>
            </div>
          </TableCell>
        </>
      )}

      {/* Actions Dropdown */}
      <TableCell className="w-10 text-center py-1.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="size-7 text-muted-foreground hover:text-foreground data-[state=open]:bg-muted"
            >
              <EllipsisVerticalIcon className="size-3.5" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEditItem && (
              <DropdownMenuItem onClick={() => onEditItem(item)} className="cursor-pointer">
                <PencilIcon className="size-3.5 mr-2" />
                <span>Edit Item</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onClick={() => onSelectProvenance({
                ...item,
                quantity: localQty !== '' ? parseFloat(localQty) || 0 : item.quantity
              })}
              className="cursor-pointer"
            >
              <ExternalLinkIcon className="size-3.5 mr-2" />
              <span>View Evidence Proof</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteItem(item)}
              className="text-destructive focus:text-destructive cursor-pointer"
            >
              <Trash2Icon className="size-3.5 mr-2" />
              <span>Delete Item</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
});

BOQTableRow.displayName = 'BOQTableRow';
