'use client'

import { useState } from 'react'

export default function SearchBar() {
  const [search, setSearch] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    window.location.href = `/?search=${encodeURIComponent(search)}`
  }

  return (
    <form onSubmit={handleSearch} className="flex gap-2 flex-1 bg-gray-100 dark:bg-gray-800 p-2 rounded-lg border border-gray-300 dark:border-gray-600">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search documents..."
        className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-500 rounded-lg text-base transition-colors focus:outline-none focus:border-blue-600 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
      />
      <button 
        type="submit" 
        className="bg-blue-600 dark:bg-blue-500 text-white px-6 py-2 rounded-lg text-base font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
      >
        Search
      </button>
    </form>
  )
}
