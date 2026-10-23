import type {
  ColumnDef,
  OnChangeFn,
  PaginationState,
} from '@tanstack/react-table'

import {
  DataTableView,
  DataTablePagination,
  useDataTable,
} from '@/components/data-table'

export function ModerationTable<T>(props: {
  items: T[]
  columns: ColumnDef<T, unknown>[]
  total: number
  pagination: PaginationState
  onPaginationChange: OnChangeFn<PaginationState>
  loading: boolean
}) {
  const { table } = useDataTable({
    data: props.items,
    columns: props.columns,
    totalCount: props.total,
    pagination: props.pagination,
    onPaginationChange: props.onPaginationChange,
    manualPagination: true,
    manualFiltering: true,
    enableSorting: false,
    enableRowSelection: false,
  })
  return (
    <div className='space-y-3'>
      <DataTableView table={table} isLoading={props.loading} />
      <DataTablePagination table={table} />
    </div>
  )
}
