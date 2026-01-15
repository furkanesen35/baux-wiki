'use client'

import { useState } from 'react'

interface PageTreeNode {
  id: string
  title: string
  children?: PageTreeNode[]
}

interface PageTreeProps {
  documents: PageTreeNode[]
  onSelectPage: (id: string | null) => void
  onCreateSubpage: (parentId: string) => void
  selectedId: string | null
}

function TreeNode({
  node,
  onSelectPage,
  onCreateSubpage,
  selectedId,
  level = 0,
}: {
  node: PageTreeNode
  onSelectPage: (id: string) => void
  onCreateSubpage: (parentId: string) => void
  selectedId: string | null
  level?: number
}) {
  const [isExpanded, setIsExpanded] = useState<boolean>(true)
  const hasChildren = node.children && node.children.length > 0

  return (
    <div>
      <div
        className={`flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer group ${
          selectedId === node.id ? 'bg-blue-50' : ''
        }`}
        style={{ paddingLeft: `${level * 1.5 + 0.5}rem` }}
      >
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsExpanded(!isExpanded)
            }}
            className="text-gray-500 hover:text-gray-700 w-4 h-4 flex-shrink-0 text-xs"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span className="w-4 flex-shrink-0"></span>}

        <span
          onClick={() => onSelectPage(node.id)}
          className="flex-1 text-sm text-gray-700 hover:text-gray-900 truncate"
        >
          {level === 0 ? '📄' : '📑'} {node.title}
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation()
            onCreateSubpage(node.id)
          }}
          className="opacity-0 group-hover:opacity-100 text-xs text-blue-600 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 flex-shrink-0"
          title="Create subpage"
        >
          + Sub
        </button>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              onSelectPage={onSelectPage}
              onCreateSubpage={onCreateSubpage}
              selectedId={selectedId}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PageTree({
  documents,
  onSelectPage,
  onCreateSubpage,
  selectedId,
}: PageTreeProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 h-full overflow-auto">
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
          <TreeNode
            key={doc.id}
            node={doc}
            onSelectPage={onSelectPage}
            onCreateSubpage={onCreateSubpage}
            selectedId={selectedId}
            level={0}
          />
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
