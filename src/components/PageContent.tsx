'use client'

import { useEffect, useState, useRef } from 'react'

interface PageContentProps {
  pageId: string
}

interface UploadedFile {
  id: string
  filename: string
  storedName: string
  mimeType: string
  size: number
  path: string
  createdAt: string
  blockId: string | null
}

interface ContentBlock {
  id: string
  type: string
  content: string
  order: number
  createdAt: string
  updatedAt: string
  attachment: UploadedFile | null
}

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  blocks: ContentBlock[]
}

export default function PageContent({ pageId }: PageContentProps) {
  const [page, setPage] = useState<Document | null>(null)
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null)
  const [zoomLevel, setZoomLevel] = useState(100)
  const editorRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingBlockIdRef = useRef<string | null>(null)
  
  // Floating toolbar state - use refs to avoid re-renders!
  const floatingToolbarRef = useRef<HTMLDivElement>(null)
  const selectedBlockIdRef = useRef<string | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})

  useEffect(() => {
    fetchPage()
  }, [pageId])

  // Hide toolbar when clicking outside content blocks
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      const isInBlock = Object.values(blockRefs.current).some(ref => ref?.contains(target))
      const isInToolbar = target.closest('[data-floating-toolbar]')
      
      if (!isInBlock && !isInToolbar) {
        hideFloatingToolbar()
      }
    }
    
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  // Show/hide toolbar using DOM manipulation (no React re-render!)
  const showFloatingToolbar = (top: number, left: number): void => {
    if (floatingToolbarRef.current) {
      floatingToolbarRef.current.style.display = 'flex'
      floatingToolbarRef.current.style.top = `${top}px`
      floatingToolbarRef.current.style.left = `${left}px`
    }
  }

  const hideFloatingToolbar = (): void => {
    if (floatingToolbarRef.current) {
      floatingToolbarRef.current.style.display = 'none'
    }
    savedRangeRef.current = null
    selectedBlockIdRef.current = null
  }

  // Handle text selection on mouse up
  const handleTextSelection = (blockId: string): void => {
    // Small delay to ensure selection is complete
    setTimeout(() => {
      const selection = window.getSelection()
      
      if (!selection || selection.isCollapsed || !selection.rangeCount) {
        hideFloatingToolbar()
        return
      }
      
      // Save the range in a ref (not state) to avoid re-renders
      const range = selection.getRangeAt(0)
      savedRangeRef.current = range.cloneRange()
      
      // Calculate position
      const rect = range.getBoundingClientRect()
      const top = rect.top + window.scrollY - 50
      const left = Math.max(10, rect.left + window.scrollX + rect.width / 2 - 75)
      
      selectedBlockIdRef.current = blockId
      showFloatingToolbar(top, left)
    }, 10)
  }

  // Apply formatting to selected text
  const applyFloatingFormat = async (command: string): Promise<void> => {
    const selectedBlockId = selectedBlockIdRef.current
    
    if (!selectedBlockId || !savedRangeRef.current) return

    const blockRef = blockRefs.current[selectedBlockId]
    if (!blockRef) return

    const selection = window.getSelection()
    if (!selection) return
    
    // Make block editable
    blockRef.contentEditable = 'true'
    blockRef.focus()
    
    // Restore selection
    selection.removeAllRanges()
    selection.addRange(savedRangeRef.current)
    
    // Apply formatting
    document.execCommand(command, false)
    
    // Get updated content
    const content = blockRef.innerHTML
    
    // Make non-editable again
    blockRef.contentEditable = 'false'
    
    // Save to database
    try {
      const response = await fetch(`/api/blocks/${selectedBlockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const updated: ContentBlock = await response.json()
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => b.id === selectedBlockId ? updated : b),
        })
      }
    } catch (error) {
      console.error('Error saving formatting:', error)
    }
    
    // Hide toolbar and clear saved range
    hideFloatingToolbar()
  }

  const fetchPage = async (): Promise<void> => {
    try {
      const response = await fetch(`/api/documents/${pageId}`)
      const data: Document = await response.json()
      setPage(data)
      setLoading(false)
    } catch (error) {
      console.error('Error fetching page:', error)
      setLoading(false)
    }
  }

  // Add block without attachment
  const handleAddTextBlock = async (): Promise<void> => {
    setShowAddMenu(false)
    if (!page) return

    try {
      const response = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: pageId,
          type: 'text',
          content: '',
          order: page.blocks.length,
        }),
      })

      if (response.ok) {
        const newBlock: ContentBlock = await response.json()
        // Add null attachment since API doesn't return it for new blocks
        newBlock.attachment = null
        setPage({
          ...page,
          blocks: [...page.blocks, newBlock],
        })
        setEditingBlockId(newBlock.id)
        setEditContent('')
      }
    } catch (error) {
      console.error('Error adding block:', error)
    }
  }

  // Add block with attachment - first create block, then upload file
  const handleAddBlockWithAttachment = (): void => {
    setShowAddMenu(false)
    fileInputRef.current?.click()
  }

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file || !page) return

    try {
      // First create the block
      const blockResponse = await fetch('/api/blocks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId: pageId,
          type: 'text',
          content: '',
          order: page.blocks.length,
        }),
      })

      if (!blockResponse.ok) throw new Error('Failed to create block')
      
      const newBlock: ContentBlock = await blockResponse.json()
      newBlock.attachment = null

      // Then upload the file attached to this block
      const formData = new FormData()
      formData.append('file', file)
      formData.append('blockId', newBlock.id)

      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        const attachment: UploadedFile = await uploadResponse.json()
        newBlock.attachment = attachment
      }

      setPage({
        ...page,
        blocks: [...page.blocks, newBlock],
      })
      setEditingBlockId(newBlock.id)
      setEditContent('')
    } catch (error) {
      console.error('Error adding block with attachment:', error)
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Upload attachment to existing block
  const handleUploadToBlock = async (blockId: string, file: File): Promise<void> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('blockId', blockId)

    try {
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        const attachment: UploadedFile = await response.json()
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => 
            b.id === blockId ? { ...b, attachment } : b
          ),
        })
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  // Remove attachment from block
  const handleRemoveAttachment = async (blockId: string, fileId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/uploads/${fileId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => 
            b.id === blockId ? { ...b, attachment: null } : b
          ),
        })
      }
    } catch (error) {
      console.error('Error removing attachment:', error)
    }
  }

  const handleSaveBlock = async (blockId: string): Promise<void> => {
    try {
      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      })

      if (response.ok) {
        const updated: ContentBlock = await response.json()
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => b.id === blockId ? updated : b),
        })
        setEditingBlockId(null)
      }
    } catch (error) {
      console.error('Error saving block:', error)
    }
  }

  const handleCancelEdit = async (blockId: string): Promise<void> => {
    const block = page?.blocks.find(b => b.id === blockId)

    // If block is empty, delete it instead of just canceling
    if (block && !block.content) {
      await handleDeleteBlock(blockId, false)
    } else {
      setEditingBlockId(null)
    }
  }

  const handleDeleteBlock = async (blockId: string, confirm: boolean = true): Promise<void> => {
    if (confirm && !window.confirm('Delete this block?')) return

    try {
      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setPage(page && {
          ...page,
          blocks: page.blocks.filter(b => b.id !== blockId),
        })
        setEditingBlockId(null)
      }
    } catch (error) {
      console.error('Error deleting block:', error)
    }
  }

  const handleStartEdit = (block: ContentBlock): void => {
    setEditingBlockId(block.id)
    setEditContent(block.content)
    // Set content after a small delay to ensure ref is ready
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = block.content || ''
      }
    }, 0)
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>): void => {
    setEditContent(e.target.value)
    // Auto-resize textarea
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  const formatText = (command: string, value?: string): void => {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  const handleEditorInput = (): void => {
    if (editorRef.current) {
      setEditContent(editorRef.current.innerHTML)
    }
  }

  const handleSaveBlockWithEditor = async (blockId: string): Promise<void> => {
    const content = editorRef.current?.innerHTML || ''

    try {
      const response = await fetch(`/api/blocks/${blockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })

      if (response.ok) {
        const updated: ContentBlock = await response.json()
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => b.id === blockId ? updated : b),
        })
        setEditingBlockId(null)
      }
    } catch (error) {
      console.error('Error saving block:', error)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-8 border-2 border-gray-200 dark:border-gray-700">
        <p className="text-gray-600 dark:text-gray-400">Loading...</p>
      </div>
    )
  }

  if (!page) {
    return null
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
          {page.title}
        </h1>
      </div>

      {/* Content Blocks */}
      <div className="min-h-[400px]">
        {page.blocks.length === 0 ? (
          <div className="flex items-center justify-center h-[300px] relative">
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-16 h-16 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-3xl font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-all hover:scale-110 shadow-lg"
              title="Add content block"
            >
              +
            </button>
            
            {/* Add menu dropdown for empty state */}
            {showAddMenu && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 translate-y-8 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[200px] z-10">
                <button
                  onClick={handleAddTextBlock}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center gap-3"
                >
                  <span className="text-xl">📝</span>
                  <span>Text Only</span>
                </button>
                <button
                  onClick={handleAddBlockWithAttachment}
                  className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center gap-3"
                >
                  <span className="text-xl">📎</span>
                  <span>Text + Attachment</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {page.blocks.map((block) => (
              <div
                key={block.id}
                className="group relative"
              >
                {editingBlockId === block.id ? (
                  <div className="space-y-3">
                    {/* Rich Text Toolbar */}
                    <div className="flex gap-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('bold')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded font-bold text-gray-900 dark:text-gray-100"
                        title="Bold (Ctrl+B)"
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('italic')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded italic text-gray-900 dark:text-gray-100"
                        title="Italic (Ctrl+I)"
                      >
                        I
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('underline')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded underline text-gray-900 dark:text-gray-100"
                        title="Underline (Ctrl+U)"
                      >
                        U
                      </button>
                      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('formatBlock', '<h1>')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded font-bold text-lg text-gray-900 dark:text-gray-100"
                        title="Heading 1"
                      >
                        H1
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('formatBlock', '<h2>')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded font-bold text-gray-900 dark:text-gray-100"
                        title="Heading 2"
                      >
                        H2
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('formatBlock', '<p>')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                        title="Paragraph"
                      >
                        P
                      </button>
                      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('insertUnorderedList')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                        title="Bullet List"
                      >
                        • List
                      </button>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          formatText('insertOrderedList')
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                        title="Numbered List"
                      >
                        1. List
                      </button>
                    </div>

                    {/* Rich Text Editor */}
                    <div className="flex gap-4">
                      <div className={block.attachment ? 'flex-1' : 'w-full'}>
                        <div
                          ref={editorRef}
                          contentEditable
                          onInput={handleEditorInput}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 bg-white dark:bg-gray-800 min-h-[80px] max-h-[500px] overflow-y-auto prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100"
                          style={{ wordBreak: 'break-word' }}
                        />
                      </div>
                      
                      {/* Attachment management in edit mode */}
                      <div className="w-64 flex-shrink-0">
                        {block.attachment ? (
                          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                            {block.attachment.mimeType.startsWith('image/') ? (
                              <img 
                                src={block.attachment.path} 
                                alt={block.attachment.filename}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <div className="w-full h-32 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center">
                                <span className="text-3xl mb-1">
                                  {block.attachment.mimeType.includes('pdf') ? '📄' :
                                   block.attachment.mimeType.includes('word') ? '📝' :
                                   block.attachment.mimeType.includes('excel') ? '📊' :
                                   '📎'}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400 px-2 text-center truncate w-full">
                                  {block.attachment.filename}
                                </span>
                              </div>
                            )}
                            <button
                              onClick={() => handleRemoveAttachment(block.id, block.attachment!.id)}
                              className="w-full bg-red-500 text-white text-xs py-2 hover:bg-red-600 transition-colors"
                            >
                              🗑️ Remove Attachment
                            </button>
                          </div>
                        ) : (
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                            <span className="text-3xl mb-1">📎</span>
                            <span className="text-xs text-gray-600 dark:text-gray-400">Add Attachment</span>
                            <input
                              type="file"
                              className="hidden"
                              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleUploadToBlock(block.id, file)
                                e.target.value = ''
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSaveBlockWithEditor(block.id)}
                        className="bg-green-600 dark:bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 dark:hover:bg-green-600 transition-colors"
                      >
                        💾 Save
                      </button>
                      <button
                        onClick={() => handleCancelEdit(block.id)}
                        className="bg-gray-500 dark:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
                      >
                        ✕ Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={`flex gap-6 ${block.attachment ? '' : ''}`}>
                    {/* Text content - full width if no attachment, left side if has attachment */}
                    <div className={block.attachment ? 'flex-1' : 'w-full'}>
                      <div
                        ref={(el) => { blockRefs.current[block.id] = el }}
                        onMouseUp={() => handleTextSelection(block.id)}
                        className="prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100 cursor-text"
                        dangerouslySetInnerHTML={{ __html: block.content || '<p class="text-gray-400 dark:text-gray-500 italic">Empty block - click edit to add content</p>' }}
                      />
                    </div>
                    
                    {/* Attachment preview - right side */}
                    {block.attachment && (
                      <div className="w-64 flex-shrink-0">
                        <div 
                          onClick={() => setPreviewFile(block.attachment)}
                          className="cursor-pointer rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors"
                        >
                          {block.attachment.mimeType.startsWith('image/') ? (
                            <img 
                              src={block.attachment.path} 
                              alt={block.attachment.filename}
                              className="w-full h-40 object-cover"
                            />
                          ) : (
                            <div className="w-full h-40 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center p-4">
                              <span className="text-4xl mb-2">
                                {block.attachment.mimeType.includes('pdf') ? '📄' :
                                 block.attachment.mimeType.includes('word') ? '📝' :
                                 block.attachment.mimeType.includes('excel') || block.attachment.mimeType.includes('spreadsheet') ? '📊' :
                                 block.attachment.mimeType.includes('powerpoint') || block.attachment.mimeType.includes('presentation') ? '📽️' :
                                 '📎'}
                              </span>
                              <span className="text-xs text-gray-600 dark:text-gray-400 text-center truncate w-full">
                                {block.attachment.filename}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => handleStartEdit(block)}
                        className="bg-blue-600 dark:bg-blue-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBlock(block.id, true)}
                        className="bg-red-500 dark:bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-600 dark:hover:bg-red-700 transition-colors"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Add block button with menu */}
            <div className="flex justify-center pt-8 relative">
              <button
                onClick={() => setShowAddMenu(!showAddMenu)}
                className="w-12 h-12 bg-blue-600 dark:bg-blue-500 text-white rounded-full text-2xl font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-all hover:scale-110 shadow-lg"
                title="Add content block"
              >
                +
              </button>
              
              {/* Add menu dropdown */}
              {showAddMenu && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 min-w-[200px] z-10">
                  <button
                    onClick={handleAddTextBlock}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center gap-3"
                  >
                    <span className="text-xl">📝</span>
                    <span>Text Only</span>
                  </button>
                  <button
                    onClick={handleAddBlockWithAttachment}
                    className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 flex items-center gap-3"
                  >
                    <span className="text-xl">📎</span>
                    <span>Text + Attachment</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Hidden file input for adding blocks with attachments */}
      <input
        ref={fileInputRef}
        type="file"
        onChange={handleFileSelected}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
      />

      {/* File Preview Popup */}
      {previewFile && (
        <div 
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
          onClick={() => { setPreviewFile(null); setZoomLevel(100) }}
        >
          {/* Close and zoom controls */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              onClick={(e) => { e.stopPropagation(); setZoomLevel(z => Math.max(25, z - 25)) }}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xl font-bold"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-white text-sm min-w-[60px] text-center">{zoomLevel}%</span>
            <button
              onClick={(e) => { e.stopPropagation(); setZoomLevel(z => Math.min(300, z + 25)) }}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xl font-bold"
              title="Zoom in"
            >
              +
            </button>
            <button
              onClick={() => { setPreviewFile(null); setZoomLevel(100) }}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-lg text-white text-xl ml-4"
              title="Close"
            >
              ✕
            </button>
          </div>
          
          {/* Preview content */}
          <div 
            className="max-h-full overflow-auto"
            onClick={(e) => e.stopPropagation()}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
          >
            {previewFile.mimeType.startsWith('image/') ? (
              <img 
                src={previewFile.path} 
                alt={previewFile.filename}
                className="max-w-none"
              />
            ) : previewFile.mimeType === 'application/pdf' ? (
              <iframe
                src={previewFile.path}
                className="w-[800px] h-[600px] bg-white"
                title={previewFile.filename}
              />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg p-12 text-center">
                <span className="text-8xl block mb-4">
                  {previewFile.mimeType.includes('word') ? '📝' :
                   previewFile.mimeType.includes('excel') || previewFile.mimeType.includes('spreadsheet') ? '📊' :
                   previewFile.mimeType.includes('powerpoint') || previewFile.mimeType.includes('presentation') ? '📽️' :
                   '📎'}
                </span>
                <p className="text-xl text-gray-900 dark:text-gray-100 mb-4">{previewFile.filename}</p>
                <a
                  href={previewFile.path}
                  download={previewFile.filename}
                  className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
                  onClick={(e) => e.stopPropagation()}
                >
                  ⬇️ Download
                </a>
              </div>
            )}
          </div>
          
          {/* Filename at bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 px-4 py-2 rounded-lg">
            <span className="text-white text-sm">{previewFile.filename}</span>
          </div>
        </div>
      )}

      {/* Floating Toolbar - Always rendered, visibility controlled via style */}
      <div
        ref={floatingToolbarRef}
        data-floating-toolbar
        className="fixed z-50 gap-1 p-2 bg-gray-900 dark:bg-gray-100 rounded-lg shadow-xl border border-gray-700 dark:border-gray-300"
        style={{ display: 'none' }}
      >
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            applyFloatingFormat('bold')
          }}
          className="px-3 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded font-bold text-white dark:text-gray-900 text-sm"
          title="Bold"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            applyFloatingFormat('italic')
          }}
          className="px-3 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded italic text-white dark:text-gray-900 text-sm"
          title="Italic"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            applyFloatingFormat('underline')
          }}
          className="px-3 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded underline text-white dark:text-gray-900 text-sm"
          title="Underline"
        >
          U
        </button>
      </div>
    </div>
  )
}