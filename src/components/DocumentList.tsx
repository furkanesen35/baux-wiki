'use client'

import { useEffect, useState } from 'react'

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  parentId: string | null
  children?: { id: string; title: string }[]
  blocks?: { id: string; content: string }[]
}

interface DocumentListProps {
  mode?: 'tree' | 'cards'
  selectedPageId?: string | null
  selectedPageTitle?: string | null
  onSelectPage?: (id: string | null, title?: string | null) => void
  onCreateSubpage?: (parentId: string, parentTitle: string) => void
}

export default function DocumentList({ 
  mode = 'cards', 
  selectedPageId = null,
  selectedPageTitle = null,
  onSelectPage,
  onCreateSubpage 
}: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchDocuments()
  }, [selectedPageId])

  const fetchDocuments = async (): Promise<void> => {
    try {
      const url = mode === 'tree' 
        ? '/api/documents?parentId=null'
        : selectedPageId 
        ? `/api/documents?parentId=${selectedPageId}`
        : '/api/documents'
      
      const response = await fetch(url)
      const data: Document[] = await response.json()
      setDocuments(data)
    } catch (error) {
      console.error('Error fetching documents:', error)
    } finally {
      setLoading(false)
    }
  }

  const toggleExpand = (id: string): void => {
    const newExpanded = new Set(expandedPages)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedPages(newExpanded)
  }

  if (loading) {
    return <div className="text-center py-12 text-gray-600 text-lg">Loading...</div>
  }

  // Tree view mode (sidebar)
  if (mode === 'tree') {
    return (
      <div className="bg-gray-100 dark:bg-gray-800 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-sm">
        <div className="flex justify-between items-center mb-4 pb-3 border-b-2 border-gray-300 dark:border-gray-600">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Page Structure</h2>
          <button
            onClick={() => onSelectPage?.(null, null)}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            All Pages
          </button>
        </div>
        
        <div className="space-y-1">
          {documents.map((doc) => (
            <div key={doc.id}>
              <div
                className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer group ${
                  selectedPageId === doc.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                }`}
              >
                {doc.children && doc.children.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleExpand(doc.id)
                    }}
                    className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 w-4 h-4 flex-shrink-0"
                  >
                    {expandedPages.has(doc.id) ? '▼' : '▶'}
                  </button>
                )}
                {(!doc.children || doc.children.length === 0) && (
                  <span className="w-4 flex-shrink-0"></span>
                )}
                
                <span
                  onClick={() => onSelectPage?.(doc.id, doc.title)}
                  className="flex-1 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100 truncate"
                >
                  📄 {doc.title}
                </span>
                
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onCreateSubpage?.(doc.id, doc.title)
                  }}
                  className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 flex-shrink-0"
                  title="Create subpage"
                >
                  + Sub
                </button>
              </div>
              
              {doc.children && doc.children.length > 0 && expandedPages.has(doc.id) && (
                <div className="ml-6 space-y-1 mt-1">
                  {doc.children.map((child) => (
                    <div
                      key={child.id}
                      onClick={() => onSelectPage?.(child.id, child.title)}
                      className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer ${
                        selectedPageId === child.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''
                      }`}
                    >
                      <span className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 truncate">
                        📑 {child.title}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {documents.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">
            No pages yet. Create your first page!
          </p>
        )}
      </div>
    )
  }

  // Cards view mode (main content)
  return (
    <div className="w-full">
      <div>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-gray-900 dark:text-gray-100 text-2xl font-semibold">
            {selectedPageId ? 'Subpages' : 'All Pages'} ({documents.length})
          </h2>
          {selectedPageId && selectedPageTitle && (
            <button
              onClick={() => onCreateSubpage?.(selectedPageId, selectedPageTitle)}
              className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors flex items-center gap-2"
              title="Add subpage"
            >
              ➕ Add Subpage
            </button>
          )}
        </div>
        {documents.length === 0 ? (
          <p className="text-center py-12 text-gray-600 dark:text-gray-400 text-lg">
            {selectedPageId ? 'No subpages yet.' : 'No pages yet. Create your first page!'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg hover:border-blue-600 dark:hover:border-blue-500"
                onClick={() => onSelectPage?.(doc.id, doc.title)}
              >
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">📄 {doc.title}</h3>
                {doc.children && doc.children.length > 0 && (
                  <div className="text-sm text-blue-600 dark:text-blue-400 mb-2">
                    📑 {doc.children.length} subpage{doc.children.length !== 1 ? 's' : ''}
                  </div>
                )}
                {doc.blocks && doc.blocks.length > 0 && (
                  <p className="text-gray-600 dark:text-gray-400 my-3 text-sm">
                    {doc.blocks.length} content block{doc.blocks.length !== 1 ? 's' : ''}
                  </p>
                )}
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
