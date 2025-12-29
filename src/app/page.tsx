'use client'

import { useState } from 'react'
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

  const handleSelectPage = (pageId: string | null, pageTitle?: string | null): void => {
    setSelectedPageId(pageId)
    setSelectedPageTitle(pageTitle || null)
  }

  const handleCreateSubpage = (parentId: string, parentTitle: string): void => {
    setParentIdForNewPage(parentId)
    setParentTitleForNewPage(parentTitle)
  }

  return (
    <div className="min-h-screen p-8 max-w-[1600px] mx-auto bg-white dark:bg-gray-900">
      <main className="flex gap-6">
        {/* Sidebar with header and page tree */}
        <aside className="w-80 flex-shrink-0">
          <div className="sticky top-8">
            <div className="mb-6 pb-4 border-b-2 border-gray-300 dark:border-gray-600">
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
        <div className="flex-1 flex flex-col gap-8">
          <div className="flex gap-4 items-center flex-wrap">
            <SearchBar />
            <UploadForm 
              parentId={parentIdForNewPage} 
              parentTitle={parentTitleForNewPage}
            />
            <ThemeToggle />
          </div>

          {!selectedPageId ? (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-12 border-2 border-blue-200 dark:border-gray-600">
              <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Welcome to Baux Wiki! 👋
              </h2>
              <div className="text-lg text-gray-700 dark:text-gray-300 space-y-4">
                <p>
                  This is your company's centralized knowledge management system. Our wiki helps the Baux team collaborate, share knowledge, and avoid duplicating work.
                </p>
                <p className="font-medium text-blue-700 dark:text-blue-400">
                  What can you do here?
                </p>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>Create and organize documentation with hierarchical pages and subpages</li>
                  <li>Upload and manage company documents in one central location</li>
                  <li>Search through all your documentation quickly and efficiently</li>
                  <li>Collaborate with your team using Markdown-formatted content</li>
                  <li>Categorize and tag documents for easy discovery</li>
                </ul>
                <p className="mt-6 text-base text-gray-600 dark:text-gray-400">
                  Get started by creating a new page using the <span className="font-semibold text-blue-600 dark:text-blue-400">"➕ New Page"</span> button above, or browse existing pages in the <span className="font-semibold">Page Structure</span> sidebar on the left.
                </p>
              </div>
            </div>
          ) : (
            <PageContent pageId={selectedPageId} />
          )}
        </div>
      </main>
    </div>
  )
}
