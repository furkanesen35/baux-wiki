'use client'

import { useState, useEffect, useCallback } from 'react'
import DocumentList from '@/components/DocumentList'
import UploadForm from '@/components/UploadForm'
import SearchBar from '@/components/SearchBar'
import PageTree from '@/components/PageTree'
import PageContent from '@/components/PageContent'
import ThemeToggle from '@/components/ThemeToggle'

export default function Home() {
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)
  const [selectedPageTitle, setSelectedPageTitle] = useState<string | null>(null)
  const [parentIdForNewPage, setParentIdForNewPage] = useState<string | null>(null)
  const [parentTitleForNewPage, setParentTitleForNewPage] = useState<string | null>(null)
  const [pendingBlockId, setPendingBlockId] = useState<string | null>(null)

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

  const handleSelectPage = (pageId: string | null, pageTitle?: string | null): void => {
    setSelectedPageId(pageId)
    setSelectedPageTitle(pageTitle || null)
    // Update URL hash when page changes
    if (pageId) {
      window.history.pushState(null, '', `#${pageId}`)
    } else {
      window.history.pushState(null, '', window.location.pathname)
    }
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

          {!selectedPageId ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-6 border-2 border-blue-200 dark:border-gray-600">
              <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                Welcome to Baux Wiki! 👋
              </h2>
              <div className="text-base text-gray-700 dark:text-gray-300 space-y-2">
                <p>
                  This is your company's centralized knowledge management system. Our wiki helps the Baux team collaborate, share knowledge, and avoid duplicating work.
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
                  Get started by creating a new page using the <span className="font-semibold text-blue-600 dark:text-blue-400">"➕ New Page"</span> button above, or browse existing pages in the <span className="font-semibold">Page Structure</span> sidebar on the left.
                </p>
              </div>
            </div>
          ) : (
            <PageContent 
              pageId={selectedPageId} 
              pendingBlockId={pendingBlockId}
              onBlockScrolled={() => setPendingBlockId(null)}
              onNavigateToBlock={handleNavigateToBlock}
            />
          )}
        </div>
      </main>
    </div>
  )
}
