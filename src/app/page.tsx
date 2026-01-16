'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import DocumentList from '@/components/DocumentList'
import UploadForm from '@/components/UploadForm'
import SearchBar from '@/components/SearchBar'
import PageContent from '@/components/PageContent'
import ThemeToggle from '@/components/ThemeToggle'

interface SearchResult {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  parent: {
    id: string
    title: string
  } | null
  blocks: Array<{
    id: string
    type: string
    content: string
    order: number
  }>
}

function HomeContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const searchQuery = searchParams.get('search')
  
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | null>(null)
  const [parentIdForNewPage, setParentIdForNewPage] = useState<string | null>(null)
  const [parentTitleForNewPage, setParentTitleForNewPage] = useState<string | null>(null)
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [highlightTerm, setHighlightTerm] = useState<string | null>(null)

  // Handle URL hash on initial load
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      // Format: #pageId or #pageId:blockId
      const parts = hash.slice(1).split(':')
      const pageId = parts[0]
      const blockId = parts[1] || null
      
      if (pageId) {
        setSelectedPageId(pageId)
        if (blockId) {
          setPendingBlockId(blockId)
        }
      }
    }
  }, [])

  // Handle search query changes
  useEffect(() => {
    if (searchQuery) {
      setSearchLoading(true)
      setSelectedPageId(null) // Clear selected page when searching
      
      fetch(`/api/documents?search=${encodeURIComponent(searchQuery)}`)
        .then(res => res.json())
        .then(data => {
          setSearchResults(data)
          setSearchLoading(false)
        })
        .catch(error => {
          console.error('Search error:', error)
          setSearchLoading(false)
        })
    } else {
      setSearchResults([])
    }
  }, [searchQuery])

  const handleSelectPage = (pageId: string | null, pageTitle?: string | null): void => {
    setSelectedPageId(pageId)
    setSelectedPageTitle(pageTitle || null)
    setHighlightTerm(null) // Clear highlight when navigating normally
    // Update URL hash when page changes
    if (pageId) {
      window.history.pushState(null, '', `#${pageId}`)
    } else {
      window.history.pushState(null, '', window.location.pathname)
    }
  }

  // Helper function to strip HTML tags and get clean text
  const stripHtml = (html: string): string => {
    if (typeof window === 'undefined') return html
    const tmp = document.createElement('div')
    tmp.innerHTML = html
    return tmp.textContent || tmp.innerText || ''
  }

  // Helper function to highlight search term in text
  const highlightText = (text: string, term: string): React.ReactNode => {
    if (!term) return text
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(regex)
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">{part}</mark>
      ) : part
    )
  }

  // Handle selecting a search result - navigate to page and clear search
  const handleSelectSearchResult = (pageId: string, pageTitle: string, term: string): void => {
    setSearchResults([]) // Clear search results
    setSelectedPageId(pageId)
    setSelectedPageTitle(pageTitle)
    setHighlightTerm(term) // Keep the search term for highlighting
    // Clear search from URL and navigate to page with hash
    router.push(`/#${pageId}`)
  }

  // Navigate to a specific page and block (used by internal wiki links)
  const handleNavigateToBlock = useCallback((pageId: string, blockId: string): void => {
    if (pageId === selectedPageId) {
      // Same page - just scroll to block
      const element = document.getElementById(blockId)
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
        }, 2000)
      }
    } else {
      // Different page - navigate and set pending block
      setSelectedPageId(pageId)
      setPendingBlockId(blockId)
      window.history.pushState(null, '', `#${pageId}:${blockId}`)
    }
  }, [selectedPageId])

  const handleCreateSubpage = (parentId: string, parentTitle: string): void => {
    setParentIdForNewPage(parentId)
    setParentTitleForNewPage(parentTitle)
  }

  return (
    <div className="min-h-screen p-4 max-w-[1600px] mx-auto bg-white dark:bg-gray-900">
      <main className="flex gap-6">
        {/* Sidebar with header and page tree */}
        <aside className="w-64 flex-shrink-0">
          <div className="sticky top-8">
            <div className="mb-6 pb-4 border-b-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity" onClick={() => setSelectedPageId(null)}>
              <h1 className="text-2xl font-bold mb-1 text-gray-900 dark:text-gray-100">📚 Baux Wiki</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Company Document Management System</p>
            </div>
            <DocumentList 
              mode="tree" 
              onSelectPage={handleSelectPage}
              onCreateSubpage={handleCreateSubpage}
              selectedPageId={selectedPageId}
            />
          </div>
        </aside>

        {/* Main content */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex gap-4 items-center flex-wrap">
            <SearchBar />
            <UploadForm 
              parentId={parentIdForNewPage} 
              parentTitle={parentTitleForNewPage}
            />
            <ThemeToggle />
          </div>

          {searchQuery ? (
            // Search results view
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  Search Results for &quot;{searchQuery}&quot;
                </h2>
                <button
                  onClick={() => router.push('/')}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear Search
                </button>
              </div>
              
              {searchLoading ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 border-gray-200 dark:border-gray-700 text-center">
                  <div className="animate-pulse text-gray-500 dark:text-gray-400">
                    Searching...
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 border-gray-200 dark:border-gray-700">
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    No results found for &quot;{searchQuery}&quot;
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {searchResults.map((result) => {
                    // Find blocks that contain the search query
                    const matchingBlocks = result.blocks.filter(block => 
                      block.content.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    const previewBlock = matchingBlocks.length > 0 ? matchingBlocks[0] : result.blocks[0]
                    const cleanPreview = previewBlock ? stripHtml(previewBlock.content) : ''
                    
                    return (
                      <div
                        key={result.id}
                        onClick={() => handleSelectSearchResult(result.id, result.title, searchQuery)}
                        className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 hover:shadow-md cursor-pointer transition-all"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                              {highlightText(result.title, searchQuery)}
                            </h3>
                            {result.parent && (
                              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                📁 {result.parent.title}
                              </p>
                            )}
                            {cleanPreview && (
                              <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                {highlightText(cleanPreview.substring(0, 200), searchQuery)}
                                {cleanPreview.length > 200 ? '...' : ''}
                              </p>
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                              {result.blocks.length} block{result.blocks.length !== 1 ? 's' : ''}
                              {matchingBlocks.length > 0 && ` • ${matchingBlocks.length} match${matchingBlocks.length !== 1 ? 'es' : ''}`}
                            </p>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500 ml-4 flex-shrink-0">
                            {new Date(result.updatedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : !selectedPageId ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border-2 border-blue-200 dark:border-gray-600">
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Welcome to Baux Wiki! 👋
              </h2>
              <div className="text-base text-gray-700 dark:text-gray-300 space-y-2">
                <p>
                  This is your company&apos;s centralized knowledge management system. Our wiki helps the Baux team collaborate, share knowledge, and avoid duplicating work.
                </p>
                <p className="font-medium text-blue-700 dark:text-blue-400">
                  What can you do here?
                </p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Create and organize documentation with hierarchical pages and subpages</li>
                  <li>Upload and manage company documents in one central location</li>
                  <li>Search through all your documentation quickly and efficiently</li>
                  <li>Collaborate with your team using Markdown-formatted content</li>
                  <li>Categorize and tag documents for easy discovery</li>
                </ul>
                <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  Get started by creating a new page using the <span className="font-semibold text-blue-600 dark:text-blue-400">&quot;➕ New Page&quot;</span> button above, or browse existing pages in the <span className="font-semibold">Page Structure</span> sidebar on the left.
                </p>
              </div>
            </div>
          ) : (
            <PageContent 
              pageId={selectedPageId} 
              pendingBlockId={pendingBlockId}
              onBlockScrolled={() => setPendingBlockId(null)}
              onNavigateToBlock={handleNavigateToBlock}
              highlightTerm={highlightTerm}
              onClearHighlight={() => setHighlightTerm(null)}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen p-4 max-w-[1600px] mx-auto bg-white dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  )
}
