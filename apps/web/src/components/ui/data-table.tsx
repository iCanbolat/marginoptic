import * as React from "react";
import {
  type Column,
  type ColumnDef,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  type Table as TanStackTable,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  ChevronUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  skeletonRows?: number;
  /**
   * Sunucu taraflı sayfalama. Üçü birlikte verilince TanStack Table manuel
   * sayfalama moduna geçer ve foto'daki sayfalama denetimi render edilir.
   */
  pagination?: PaginationState;
  onPaginationChange?: OnChangeFn<PaginationState>;
  /** Filtre uygulanmış toplam kayıt sayısı (sunucudan). */
  rowCount?: number;
  /** "Sayfa başına" seçenekleri. */
  pageSizeOptions?: number[];
  /** Sayfa geçişi sırasında veri çekilirken denetimleri devre dışı bırakır. */
  isFetching?: boolean;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  isLoading = false,
  emptyMessage = "Kayıt bulunamadı.",
  skeletonRows = 5,
  pagination,
  onPaginationChange,
  rowCount,
  pageSizeOptions = [10, 25, 50, 100],
  isFetching = false,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>({});

  const manualPagination = !!(pagination && onPaginationChange);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnVisibility,
      ...(pagination && { pagination }),
    },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    onPaginationChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination,
    // rowCount verilince TanStack getPageCount()'u türetir.
    ...(manualPagination && { rowCount }),
  });

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  colSpan={header.colSpan}
                  style={
                    header.getSize() !== 150
                      ? { width: header.getSize() }
                      : undefined
                  }
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <TableRow key={`skeleton-${i}`}>
                {table.getVisibleLeafColumns().map((col) => (
                  <TableCell key={col.id}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.getIsSelected() ? "selected" : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="h-24 text-center text-muted-foreground"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {manualPagination && (
        <DataTablePagination
          table={table}
          pageSizeOptions={pageSizeOptions}
          isFetching={isFetching}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTablePagination — TanStack Table tabanlı sayfalama denetimi
// ---------------------------------------------------------------------------

interface DataTablePaginationProps<TData> {
  table: TanStackTable<TData>;
  pageSizeOptions: number[];
  isFetching: boolean;
}

export function DataTablePagination<TData>({
  table,
  pageSizeOptions,
  isFetching,
}: DataTablePaginationProps<TData>) {
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = table.getPageCount();

  return (
    <div className="flex flex-col-reverse items-center gap-4 px-2 sm:flex-row sm:justify-between">
      <div className="text-xs text-muted-foreground">
        Toplam {table.getRowCount()} kayıt
      </div>

      <div className="flex items-center gap-4 sm:gap-6 lg:gap-8">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium">Sayfa başına</p>
          <Select
            value={`${pageSize}`}
            onValueChange={(value) =>
              // Boyut değişince ilk sayfaya dön.
              table.setPagination({ pageIndex: 0, pageSize: Number(value) })
            }
          >
            <SelectTrigger className="h-8 w-18">
              <SelectValue placeholder={pageSize} />
            </SelectTrigger>
            <SelectContent>
              {pageSizeOptions.map((size) => (
                <SelectItem key={size} value={`${size}`}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex min-w-20 items-center justify-center text-xs font-medium">
          Sayfa {pageIndex + 1} / {Math.max(pageCount, 1)}
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="İlk sayfa"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage() || isFetching}
          >
            <ChevronsLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Önceki sayfa"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage() || isFetching}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Sonraki sayfa"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage() || isFetching}
          >
            <ChevronRight />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            aria-label="Son sayfa"
            onClick={() => table.setPageIndex(pageCount - 1)}
            disabled={!table.getCanNextPage() || isFetching}
          >
            <ChevronsRight />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataTableColumnHeader — sıralanabilir kolon başlığı
// ---------------------------------------------------------------------------

interface DataTableColumnHeaderProps<TData, TValue>
  extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span className={className}>{title}</span>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => column.toggleSorting(sorted === "asc")}
      className={cn("-mx-2.5 h-7 data-[state=open]:bg-accent", className)}
    >
      {title}
      {sorted === "asc" ? (
        <ChevronUp />
      ) : sorted === "desc" ? (
        <ChevronDown />
      ) : (
        <ChevronsUpDown className="text-muted-foreground" />
      )}
    </Button>
  );
}
