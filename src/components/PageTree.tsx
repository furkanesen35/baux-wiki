'use client'

import { useState } from 'react'

interface PageTreeNode {
  id: string
  title: string
  children?: { id: string; title: string }[]
}

interface PageTreeProps {
  documents: PageTreeNode[]
  onSelectPage: (id: string | null) => void
  onCreateSubpage: (parentId: string) => void
  selectedId: string | null
}

export default function PageTree({ documents, onSelectPage, onCreateSubpage, selectedId }: PageTreeProps) {
  const [expandedPages, setExpandedPages] = useState<Set<string>>(new Set())

  const toggleExpand = (id: string): void => {
    const newExpanded = new Set(expandedPages)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedPages(newExpanded)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900">Page Structure</h2>
        <button
          onClick={() => onSelectPage(null)}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Show All
        </button>
      </div>
      
      <div className="space-y-1">
        {documents.map((doc) => (
          <div key={doc.id}>
            <div
              className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer group ${
                selectedId === doc.id ? 'bg-blue-50' : ''
              }`}
            >
              {doc.children && doc.children.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleExpand(doc.id)
                  }}
                  className="text-gray-500 hover:text-gray-700 w-4 h-4 flex-shrink-0"
                >
                  {expandedPages.has(doc.id) ? '▼' : '▶'}
                </button>
              )}
              {(!doc.children || doc.children.length === 0) && (
                <span className="w-4 flex-shrink-0"></span>
              )}
              
              <span
                onClick={() => onSelectPage(doc.id)}
                className="flex-1 text-sm text-gray-700 hover:text-gray-900"
              >
                📄 {doc.title}
              </span>
              
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onCreateSubpage(doc.id)
                }}
                className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50"
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
                    onClick={() => onSelectPage(child.id)}
                    className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer ${
                      selectedId === child.id ? 'bg-blue-50' : ''
                    }`}
                  >
                    <span className="text-sm text-gray-600 hover:text-gray-900">
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
