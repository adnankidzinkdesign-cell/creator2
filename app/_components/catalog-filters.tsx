'use client'

import { Select, SelectItem, TextInput } from '@tremor/react'
import { ALL_VALUE, ITEM_TYPE_OPTIONS, type CatalogView } from './catalog-utils'

export function CatalogFilters({
  query,
  category,
  subcategory,
  itemType,
  ageRange,
  suitableSpace,
  view,
  categories,
  subcategories,
  ageRanges,
  suitableSpaces,
  hasActiveFilters,
  onQueryChange,
  onCategoryChange,
  onSubcategoryChange,
  onItemTypeChange,
  onAgeRangeChange,
  onSuitableSpaceChange,
  onViewChange,
  onClearFilters,
}: {
  query: string
  category: string
  subcategory: string
  itemType: string
  ageRange: string
  suitableSpace: string
  view: CatalogView
  categories: string[]
  subcategories: string[]
  ageRanges: string[]
  suitableSpaces: string[]
  hasActiveFilters: boolean
  onQueryChange: (value: string) => void
  onCategoryChange: (value: string) => void
  onSubcategoryChange: (value: string) => void
  onItemTypeChange: (value: string) => void
  onAgeRangeChange: (value: string) => void
  onSuitableSpaceChange: (value: string) => void
  onViewChange: (view: CatalogView) => void
  onClearFilters: () => void
}) {
  return (
    <div className="dashboard-panel catalog-flat-panel flex flex-wrap items-stretch gap-3 p-4">
      <div className="min-w-[18rem] flex-[2_1_22rem]">
        <TextInput
          className="w-full"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onValueChange={onQueryChange}
          placeholder="Search SKU, name, description, finishes..."
          aria-label="Search catalog"
        />
      </div>
      <div className="min-w-[12rem] flex-1">
        <Select
          className="w-full"
          value={category}
          onValueChange={(val) => { onCategoryChange(val); onSubcategoryChange(ALL_VALUE) }}
          aria-label="Filter by category"
        >
          <SelectItem value={ALL_VALUE}>All categories</SelectItem>
          {categories.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="min-w-[12rem] flex-1">
        <Select
          className="w-full"
          value={subcategory}
          onValueChange={onSubcategoryChange}
          aria-label="Filter by subcategory"
        >
          <SelectItem value={ALL_VALUE}>All subcategories</SelectItem>
          {subcategories.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="min-w-[11rem] flex-1">
        <Select
          className="w-full"
          value={itemType}
          onValueChange={onItemTypeChange}
          aria-label="Filter by item type"
        >
          <SelectItem value={ALL_VALUE}>All item types</SelectItem>
          {ITEM_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="min-w-[11rem] flex-1">
        <Select
          className="w-full"
          value={ageRange}
          onValueChange={onAgeRangeChange}
          aria-label="Filter by age range"
        >
          <SelectItem value={ALL_VALUE}>All ages</SelectItem>
          {ageRanges.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="min-w-[11rem] flex-1">
        <Select
          className="w-full"
          value={suitableSpace}
          onValueChange={onSuitableSpaceChange}
          aria-label="Filter by suitable space"
        >
          <SelectItem value={ALL_VALUE}>All spaces</SelectItem>
          {suitableSpaces.map((value) => (
            <SelectItem key={value} value={value}>{value}</SelectItem>
          ))}
        </Select>
      </div>
      <div className="flex min-w-[15rem] items-stretch gap-3">
        <div className="grid flex-1 grid-cols-2 rounded-full border border-[rgba(109,91,81,0.18)] bg-white/55 p-1">
          <button
            type="button"
            aria-pressed={view === 'list'}
            onClick={() => onViewChange('list')}
            className={
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
              (view === 'list' ? 'bg-[#2e2d2c] text-[#f7f1ea] shadow-sm' : 'text-tremor-content hover:text-tremor-content-strong')
            }
          >
            List
          </button>
          <button
            type="button"
            aria-pressed={view === 'cards'}
            onClick={() => onViewChange('cards')}
            className={
              'whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ' +
              (view === 'cards' ? 'bg-[#2e2d2c] text-[#f7f1ea] shadow-sm' : 'text-tremor-content hover:text-tremor-content-strong')
            }
          >
            Cards
          </button>
        </div>
        <button
          type="button"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          className="whitespace-nowrap rounded-full border border-[rgba(109,91,81,0.18)] bg-white/60 px-4 py-2 text-sm font-medium text-tremor-content-strong transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  )
}
