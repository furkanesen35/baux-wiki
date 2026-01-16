'use client'

import { useEffect, useState, useRef } from 'react'

interface PageContentProps {
  pageId: string
  pendingBlockId?: string | null
  onBlockScrolled?: () => void
  onNavigateToBlock?: (pageId: string, blockId: string) => void
  highlightTerm?: string | null
  onClearHighlight?: () => void
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
  attachments: UploadedFile[]
}

interface Document {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  blocks: ContentBlock[]
}

// Helper function to convert plain URLs into clickable links
const linkifyContent = (html: string): string => {
  // Don't process if it's empty or already has links for this URL
  if (!html) return html
  
  // Match URLs that are not already inside an href or <a> tag
  // This regex matches URLs not preceded by " or >
  const urlRegex = /(?<!href=")(?<!>)(https?:\/\/[^\s<"]+)/gi
  
  return html.replace(urlRegex, (url) => {
    // Check if this URL is already part of an anchor tag
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 hover:underline">${url}</a>`
  })
}

export default function PageContent({ pageId, pendingBlockId, onBlockScrolled, onNavigateToBlock, highlightTerm, onClearHighlight }: PageContentProps) {
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
  const savedSelectionTextRef = useRef<string>('')
  const blockRefs = useRef<{ [key: string]: HTMLDivElement | null }>({})
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [showFontSizeDropdown, setShowFontSizeDropdown] = useState(false)
  
  // Inline image state
  const [selectedImage, setSelectedImage] = useState<HTMLElement | null>(null)
  const [imageWrap, setImageWrap] = useState<string>('left')
  const inlineImageInputRef = useRef<HTMLInputElement>(null)
  const isResizingRef = useRef(false)
  const isDraggingImageRef = useRef(false)
  
  const SELECTION_MARKER_ID = 'baux-selection-marker'

  useEffect(() => {
    fetchPage()
  }, [pageId])

  // Scroll to pending block when page loads
  // Helper function to get all images from all blocks
  const getAllImages = (): UploadedFile[] => {
    if (!page) return []
    const allImages: UploadedFile[] = []
    page.blocks.forEach(block => {
      block.attachments.forEach(attachment => {
        if (attachment.mimeType.startsWith('image/')) {
          allImages.push(attachment)
        }
      })
    })
    return allImages
  }

  // Navigate to next/previous image in preview
  const navigatePreview = (direction: 'next' | 'prev'): void => {
    if (!previewFile) return
    const allImages = getAllImages()
    const currentIndex = allImages.findIndex(img => img.id === previewFile.id)
    if (currentIndex === -1) return
    
    let newIndex: number
    if (direction === 'next') {
      newIndex = (currentIndex + 1) % allImages.length
    } else {
      newIndex = (currentIndex - 1 + allImages.length) % allImages.length
    }
    setPreviewFile(allImages[newIndex])
    setZoomLevel(100)
  }

  // Keyboard navigation for preview popup
  useEffect(() => {
    if (!previewFile) return
    
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setPreviewFile(null)
        setZoomLevel(100)
      } else if (e.key === 'ArrowLeft') {
        navigatePreview('prev')
      } else if (e.key === 'ArrowRight') {
        navigatePreview('next')
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [previewFile, page])

  useEffect(() => {
    if (page && pendingBlockId) {
      const element = document.getElementById(pendingBlockId)
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight the block briefly
          element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
          setTimeout(() => {
            element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
          }, 2000)
          onBlockScrolled?.()
        }, 100)
      }
    }
  }, [page, pendingBlockId, onBlockScrolled])

  // Apply highlight to search term and scroll to first match
  useEffect(() => {
    if (page && highlightTerm) {
      setTimeout(() => {
        // Find the first highlighted mark element and scroll to it
        const firstMark = document.querySelector('.search-highlight')
        if (firstMark) {
          firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }, 200)
    }
  }, [page, highlightTerm])

  // Helper function to highlight search term in HTML content
  const highlightSearchTerm = (html: string, term: string | null | undefined): string => {
    if (!term) return html
    // Escape special regex characters in the search term
    const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Match the term but not inside HTML tags
    const regex = new RegExp(`(?![^<]*>)(${escapedTerm})`, 'gi')
    return html.replace(regex, '<mark class="search-highlight bg-yellow-300 dark:bg-yellow-600 px-0.5 rounded">$1</mark>')
  }

  // Handle clicks on internal wiki links
  useEffect(() => {
    const handleLinkClick = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')
      
      if (anchor && anchor.href) {
        const url = new URL(anchor.href)
        
        // Check if it's an internal wiki link (same origin with hash)
        if (url.origin === window.location.origin && url.hash) {
          const hash = url.hash.slice(1) // Remove #
          const parts = hash.split(':')
          
          if (parts.length === 2) {
            // Format: #pageId:blockId
            e.preventDefault()
            const [targetPageId, targetBlockId] = parts
            onNavigateToBlock?.(targetPageId, targetBlockId)
          } else if (parts.length === 1 && parts[0].length > 10) {
            // Looks like a block ID on current page
            e.preventDefault()
            const element = document.getElementById(parts[0])
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' })
              element.classList.add('ring-2', 'ring-blue-500', 'ring-offset-2')
              setTimeout(() => {
                element.classList.remove('ring-2', 'ring-blue-500', 'ring-offset-2')
              }, 2000)
            }
          }
        }
      }
    }
    
    document.addEventListener('click', handleLinkClick)
    return () => document.removeEventListener('click', handleLinkClick)
  }, [onNavigateToBlock])

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
    
    // Remove any marker spans from all blocks
    const selectedBlockId = selectedBlockIdRef.current
    if (selectedBlockId) {
      const blockRef = blockRefs.current[selectedBlockId]
      if (blockRef) {
        const marker = blockRef.querySelector(`#${SELECTION_MARKER_ID}`)
        if (marker) {
          const parent = marker.parentNode
          while (marker.firstChild) {
            parent?.insertBefore(marker.firstChild, marker)
          }
          marker.remove()
        }
      }
    }
    
    savedRangeRef.current = null
    savedSelectionTextRef.current = ''
    selectedBlockIdRef.current = null
    setShowColorPicker(false)
    setShowFontSizeDropdown(false)
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
      
      // Save the selected text
      savedSelectionTextRef.current = selection.toString()
      
      // Get the range and wrap selected text in a marker span
      const range = selection.getRangeAt(0)
      const blockRef = blockRefs.current[blockId]
      
      if (blockRef) {
        // Remove any existing marker first
        const existingMarker = blockRef.querySelector(`#${SELECTION_MARKER_ID}`)
        if (existingMarker) {
          const parent = existingMarker.parentNode
          while (existingMarker.firstChild) {
            parent?.insertBefore(existingMarker.firstChild, existingMarker)
          }
          existingMarker.remove()
        }
        
        // Wrap the selection in a marker span
        try {
          blockRef.contentEditable = 'true'
          const markerSpan = document.createElement('span')
          markerSpan.id = SELECTION_MARKER_ID
          range.surroundContents(markerSpan)
          blockRef.contentEditable = 'false'
          
          // Save the range
          savedRangeRef.current = range.cloneRange()
        } catch (e) {
          // surroundContents can fail if selection spans multiple elements
          // Fall back to saving just the range
          savedRangeRef.current = range.cloneRange()
        }
      } else {
        savedRangeRef.current = range.cloneRange()
      }
      
      // Calculate position
      const rect = range.getBoundingClientRect()
      const top = rect.top + window.scrollY - 50
      const left = Math.max(10, rect.left + window.scrollX + rect.width / 2 - 75)
      
      selectedBlockIdRef.current = blockId
      showFloatingToolbar(top, left)
    }, 10)
  }

  // Helper to get current font size of selection
  const getCurrentFontSize = (): number => {
    // Use saved range if selection is lost
    const selection = window.getSelection()
    let range: Range | null = null
    
    if (selection && selection.rangeCount > 0) {
      range = selection.getRangeAt(0)
    } else if (savedRangeRef.current) {
      range = savedRangeRef.current
    }
    
    if (!range) return 3 // Default size
    
    const container = range.commonAncestorContainer
    const element = container.nodeType === 3 ? container.parentElement : container as HTMLElement
    
    if (element) {
      // Check for font tag with size attribute
      const fontTag = element.closest('font[size]')
      if (fontTag) {
        return parseInt(fontTag.getAttribute('size') || '3')
      }
      // Check inline style font-size
      const computedSize = window.getComputedStyle(element).fontSize
      const sizeInPx = parseInt(computedSize)
      // Map px to font size scale (1-7)
      if (sizeInPx <= 10) return 1
      if (sizeInPx <= 13) return 2
      if (sizeInPx <= 16) return 3
      if (sizeInPx <= 18) return 4
      if (sizeInPx <= 24) return 5
      if (sizeInPx <= 32) return 6
      return 7
    }
    return 3
  }

  // Apply formatting to selected text
  const applyFloatingFormat = async (command: string, value?: string): Promise<void> => {
    const selectedBlockId = selectedBlockIdRef.current
    
    if (!selectedBlockId) return

    const blockRef = blockRefs.current[selectedBlockId]
    if (!blockRef) return

    const selection = window.getSelection()
    if (!selection) return
    
    // Make block editable
    blockRef.contentEditable = 'true'
    blockRef.focus()
    
    // Find the marker span and select its contents
    const markerSpan = blockRef.querySelector(`#${SELECTION_MARKER_ID}`)
    
    selection.removeAllRanges()
    
    if (markerSpan) {
      // Select the marker span's contents
      const range = document.createRange()
      range.selectNodeContents(markerSpan)
      selection.addRange(range)
    } else if (savedRangeRef.current) {
      // Fallback to saved range
      try {
        selection.addRange(savedRangeRef.current)
      } catch (e) {
        blockRef.contentEditable = 'false'
        return
      }
    } else {
      blockRef.contentEditable = 'false'
      return
    }
    
    // Apply formatting
    if (value !== undefined) {
      document.execCommand(command, false, value)
    } else {
      document.execCommand(command, false)
    }
    
    // Get updated content - strip marker span ID from content before saving
    // The marker span wraps the selected text, we need to remove just the span tags, keeping contents
    let content = blockRef.innerHTML
    
    // Remove the marker span tags but keep inner content
    const markerRegex = new RegExp(`<span\\s+id="${SELECTION_MARKER_ID}"[^>]*>(.*?)</span>`, 'gs')
    const cleanContent = content.replace(markerRegex, '$1')
    
    // Keep toolbar open for color picker and font size, re-select the text for next change
    if (command === 'foreColor' || command === 'hiliteColor' || command === 'fontSize') {
      // Keep block editable temporarily to re-establish selection
      blockRef.contentEditable = 'true'
      
      // Re-select the same range
      const newSelection = window.getSelection()
      if (newSelection && savedRangeRef.current) {
        try {
          newSelection.removeAllRanges()
          newSelection.addRange(savedRangeRef.current)
        } catch (e) {
          // If range is invalid, select all content
          const newRange = document.createRange()
          newRange.selectNodeContents(blockRef)
          newSelection.removeAllRanges()
          newSelection.addRange(newRange)
          savedRangeRef.current = newRange.cloneRange()
        }
      }
      
      blockRef.contentEditable = 'false'
    } else {
      // Make non-editable for other commands
      blockRef.contentEditable = 'false'
    }
    
    // Save to database with cleaned content (no marker span)
    try {
      const response = await fetch(`/api/blocks/${selectedBlockId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: cleanContent }),
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
    
    // Keep toolbar open for color picker and font size, hide for other commands
    if (command === 'foreColor' || command === 'hiliteColor' || command === 'fontSize') {
      // Keep toolbar visible and selection active for color picker and font size
      return
    }
    
    // Hide toolbar for other commands
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
        // Add empty attachments array since API doesn't return it for new blocks
        newBlock.attachments = []
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
    const files = e.target.files
    if (!files || files.length === 0 || !page) return

    try {
      // Create ONE block for all files
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
      newBlock.attachments = []

      // Upload all files to this single block
      const formData = new FormData()
      for (let i = 0; i < files.length; i++) {
        formData.append('file', files[i])
      }
      formData.append('blockId', newBlock.id)

      const uploadResponse = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })

      if (uploadResponse.ok) {
        const attachments = await uploadResponse.json()
        // Handle both single file (object) and multiple files (array) response
        newBlock.attachments = Array.isArray(attachments) ? attachments : [attachments]
      }

      setPage({
        ...page,
        blocks: [...page.blocks, newBlock],
      })
      setEditingBlockId(newBlock.id)
      setEditContent('')
    } catch (error) {
      console.error('Error adding block with attachments:', error)
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
        const newAttachment: UploadedFile = await response.json()
        setPage(page && {
          ...page,
          blocks: page.blocks.map(b => 
            b.id === blockId ? { ...b, attachments: [...b.attachments, newAttachment] } : b
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
            b.id === blockId ? { ...b, attachments: b.attachments.filter(a => a.id !== fileId) } : b
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
      deselectImage()
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

  // ===== Inline Image Functions =====
  
  // Insert image into editor at cursor position
  const insertImageIntoEditor = async (file: File): Promise<void> => {
    if (!editorRef.current) return
    
    try {
      // Upload the file first
      const formData = new FormData()
      formData.append('file', file)
      formData.append('blockId', editingBlockId || '')
      
      const response = await fetch('/api/uploads', {
        method: 'POST',
        body: formData,
      })
      
      if (!response.ok) throw new Error('Upload failed')
      
      const uploadedFile: UploadedFile = await response.json()
      
      // Create the inline image wrapper
      const wrapper = document.createElement('span')
      wrapper.className = 'inline-image'
      wrapper.setAttribute('data-wrap', 'left')
      wrapper.setAttribute('data-file-id', uploadedFile.id)
      wrapper.setAttribute('contenteditable', 'false')
      wrapper.setAttribute('draggable', 'true')
      
      const img = document.createElement('img')
      img.src = `/api/files/${uploadedFile.id}`
      img.alt = uploadedFile.filename
      img.style.maxWidth = '300px'
      img.style.height = 'auto'
      
      // Add resize handles
      const handles = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se']
      handles.forEach(pos => {
        const handle = document.createElement('span')
        handle.className = `resize-handle ${pos}`
        handle.setAttribute('data-handle', pos)
        wrapper.appendChild(handle)
      })
      
      wrapper.appendChild(img)
      
      // Insert at cursor position
      editorRef.current.focus()
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        range.deleteContents()
        range.insertNode(wrapper)
        range.setStartAfter(wrapper)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      } else {
        editorRef.current.appendChild(wrapper)
      }
      
      // Trigger content update
      handleEditorInput()
      
      // Select the newly inserted image
      selectImage(wrapper)
    } catch (error) {
      console.error('Error inserting image:', error)
      alert('Failed to insert image')
    }
  }
  
  // Select an inline image
  const selectImage = (imageWrapper: HTMLElement): void => {
    // Deselect previous
    if (selectedImage) {
      selectedImage.classList.remove('selected')
    }
    
    imageWrapper.classList.add('selected')
    setSelectedImage(imageWrapper)
    setImageWrap(imageWrapper.getAttribute('data-wrap') || 'inline')
  }
  
  // Deselect inline image
  const deselectImage = (): void => {
    if (selectedImage) {
      selectedImage.classList.remove('selected')
    }
    setSelectedImage(null)
  }
  
  // Change image wrap style
  const changeImageWrap = (wrap: string): void => {
    if (!selectedImage) return
    
    selectedImage.setAttribute('data-wrap', wrap)
    setImageWrap(wrap)
    handleEditorInput()
  }
  
  // Delete selected image
  const deleteSelectedImage = (): void => {
    if (!selectedImage) return
    
    const fileId = selectedImage.getAttribute('data-file-id')
    selectedImage.remove()
    setSelectedImage(null)
    handleEditorInput()
    
    // Optionally delete from server
    if (fileId) {
      fetch(`/api/uploads/${fileId}`, { method: 'DELETE' }).catch(console.error)
    }
  }
  
  // Handle editor click for image selection
  const handleEditorClick = (e: React.MouseEvent): void => {
    const target = e.target as HTMLElement
    
    // Check if clicked on inline image or its child
    const imageWrapper = target.closest('.inline-image') as HTMLElement
    if (imageWrapper && editorRef.current?.contains(imageWrapper)) {
      e.preventDefault()
      e.stopPropagation()
      selectImage(imageWrapper)
      return
    }
    
    // Clicked elsewhere, deselect
    deselectImage()
  }
  
  // Handle resize
  const handleResizeStart = (e: React.MouseEvent, handle: string): void => {
    if (!selectedImage) return
    e.preventDefault()
    e.stopPropagation()
    
    isResizingRef.current = true
    const img = selectedImage.querySelector('img') as HTMLImageElement
    if (!img) return
    
    const startX = e.clientX
    const startY = e.clientY
    const startWidth = img.offsetWidth
    const startHeight = img.offsetHeight
    const aspectRatio = startWidth / startHeight
    
    const onMouseMove = (moveEvent: MouseEvent): void => {
      if (!isResizingRef.current) return
      
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      
      let newWidth = startWidth
      let newHeight = startHeight
      
      if (handle.includes('e')) newWidth = startWidth + deltaX
      if (handle.includes('w')) newWidth = startWidth - deltaX
      if (handle.includes('s')) newHeight = startHeight + deltaY
      if (handle.includes('n')) newHeight = startHeight - deltaY
      
      // Maintain aspect ratio for corner handles
      if (handle.length === 2) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          newHeight = newWidth / aspectRatio
        } else {
          newWidth = newHeight * aspectRatio
        }
      }
      
      // Min size
      newWidth = Math.max(50, newWidth)
      newHeight = Math.max(50, newHeight)
      
      img.style.width = `${newWidth}px`
      img.style.height = `${newHeight}px`
      img.style.maxWidth = 'none'
    }
    
    const onMouseUp = (): void => {
      isResizingRef.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
      handleEditorInput()
    }
    
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }
  
  // Handle drag start for image
  const handleImageDragStart = (e: React.DragEvent, imageWrapper: HTMLElement): void => {
    isDraggingImageRef.current = true
    imageWrapper.classList.add('dragging')
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/html', imageWrapper.outerHTML)
    e.dataTransfer.setData('application/x-inline-image', 'true')
  }
  
  // Handle drag end
  const handleImageDragEnd = (e: React.DragEvent): void => {
    isDraggingImageRef.current = false
    const target = e.target as HTMLElement
    const imageWrapper = target.closest('.inline-image')
    if (imageWrapper) {
      imageWrapper.classList.remove('dragging')
    }
  }
  
  // Handle drop in editor
  const handleEditorDrop = (e: React.DragEvent): void => {
    if (!editorRef.current) return
    
    const isInlineImage = e.dataTransfer.getData('application/x-inline-image')
    
    if (isInlineImage) {
      e.preventDefault()
      
      // Get the drop position
      const range = document.caretRangeFromPoint(e.clientX, e.clientY)
      if (!range) return
      
      // Remove the original dragged element
      const dragging = editorRef.current.querySelector('.inline-image.dragging')
      const html = e.dataTransfer.getData('text/html')
      
      if (dragging) {
        dragging.remove()
      }
      
      // Insert at new position
      const temp = document.createElement('div')
      temp.innerHTML = html
      const newImage = temp.firstChild as HTMLElement
      if (newImage) {
        newImage.classList.remove('dragging')
        range.insertNode(newImage)
        selectImage(newImage)
      }
      
      handleEditorInput()
    } else {
      // Handle dropped files
      const files = e.dataTransfer.files
      if (files.length > 0) {
        e.preventDefault()
        Array.from(files).forEach(file => {
          if (file.type.startsWith('image/')) {
            insertImageIntoEditor(file)
          }
        })
      }
    }
  }
  
  // Keyboard handler for delete
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (selectedImage && editingBlockId) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          deleteSelectedImage()
        } else if (e.key === 'Escape') {
          deselectImage()
        }
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedImage, editingBlockId])
  
  // Setup event delegation for inline images in editor
  useEffect(() => {
    const editor = editorRef.current
    if (!editor || !editingBlockId) return
    
    // Handle mousedown on resize handles
    const handleMouseDown = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      
      // Check for resize handle
      if (target.classList.contains('resize-handle')) {
        e.preventDefault()
        e.stopPropagation()
        const handle = target.getAttribute('data-handle') || ''
        const imageWrapper = target.closest('.inline-image') as HTMLElement
        if (imageWrapper) {
          selectImage(imageWrapper)
          
          isResizingRef.current = true
          const img = imageWrapper.querySelector('img') as HTMLImageElement
          if (!img) return
          
          const startX = e.clientX
          const startY = e.clientY
          const startWidth = img.offsetWidth
          const startHeight = img.offsetHeight
          const aspectRatio = startWidth / startHeight
          
          const onMouseMove = (moveEvent: MouseEvent): void => {
            if (!isResizingRef.current) return
            
            let deltaX = moveEvent.clientX - startX
            let deltaY = moveEvent.clientY - startY
            
            let newWidth = startWidth
            let newHeight = startHeight
            
            if (handle.includes('e')) newWidth = startWidth + deltaX
            if (handle.includes('w')) newWidth = startWidth - deltaX
            if (handle.includes('s')) newHeight = startHeight + deltaY
            if (handle.includes('n')) newHeight = startHeight - deltaY
            
            // Maintain aspect ratio for corner handles
            if (handle.length === 2) {
              if (Math.abs(deltaX) > Math.abs(deltaY)) {
                newHeight = newWidth / aspectRatio
              } else {
                newWidth = newHeight * aspectRatio
              }
            }
            
            newWidth = Math.max(50, newWidth)
            newHeight = Math.max(50, newHeight)
            
            img.style.width = `${newWidth}px`
            img.style.height = `${newHeight}px`
            img.style.maxWidth = 'none'
          }
          
          const onMouseUp = (): void => {
            isResizingRef.current = false
            document.removeEventListener('mousemove', onMouseMove)
            document.removeEventListener('mouseup', onMouseUp)
            handleEditorInput()
          }
          
          document.addEventListener('mousemove', onMouseMove)
          document.addEventListener('mouseup', onMouseUp)
        }
      }
    }
    
    // Handle drag start on inline images
    const handleDragStart = (e: DragEvent): void => {
      const target = e.target as HTMLElement
      const imageWrapper = target.closest('.inline-image') as HTMLElement
      if (imageWrapper && editor.contains(imageWrapper)) {
        isDraggingImageRef.current = true
        imageWrapper.classList.add('dragging')
        e.dataTransfer?.setData('text/html', imageWrapper.outerHTML)
        e.dataTransfer?.setData('application/x-inline-image', 'true')
      }
    }
    
    // Handle drag end
    const handleDragEnd = (e: DragEvent): void => {
      isDraggingImageRef.current = false
      const target = e.target as HTMLElement
      const imageWrapper = target.closest('.inline-image')
      if (imageWrapper) {
        imageWrapper.classList.remove('dragging')
      }
    }
    
    editor.addEventListener('mousedown', handleMouseDown)
    editor.addEventListener('dragstart', handleDragStart)
    editor.addEventListener('dragend', handleDragEnd)
    
    return () => {
      editor.removeEventListener('mousedown', handleMouseDown)
      editor.removeEventListener('dragstart', handleDragStart)
      editor.removeEventListener('dragend', handleDragEnd)
    }
  }, [editingBlockId, selectedImage])
  
  // ===== End Inline Image Functions =====

  // Clean content before saving - remove resize handles and selection states
  const cleanContentForSave = (html: string): string => {
    const temp = document.createElement('div')
    temp.innerHTML = html
    
    // Remove all resize handles
    temp.querySelectorAll('.resize-handle').forEach(el => el.remove())
    
    // Remove selected class from images
    temp.querySelectorAll('.inline-image.selected').forEach(el => {
      el.classList.remove('selected')
    })
    
    // Remove dragging class
    temp.querySelectorAll('.inline-image.dragging').forEach(el => {
      el.classList.remove('dragging')
    })
    
    return temp.innerHTML
  }

  const handleSaveBlockWithEditor = async (blockId: string): Promise<void> => {
    const rawContent = editorRef.current?.innerHTML || ''
    const content = cleanContentForSave(rawContent)

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
        deselectImage()
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
        {highlightTerm && (
          <div className="mt-3 flex items-center gap-3 text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              Highlighting: <mark className="bg-yellow-300 dark:bg-yellow-600 px-1 rounded">{highlightTerm}</mark>
            </span>
            <button
              onClick={() => onClearHighlight?.()}
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear highlight
            </button>
          </div>
        )}
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
                id={block.id}
                className="group relative scroll-mt-4 transition-all duration-300"
              >
                {editingBlockId === block.id ? (
                  <div className="space-y-3">
                    {/* Rich Text Toolbar */}
                    <div className="flex gap-1 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 flex-wrap">
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
                      
                      {/* Font Size Dropdown */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowFontSizeDropdown(!showFontSizeDropdown)}
                          className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100 flex items-center gap-1"
                          title="Font Size"
                        >
                          <span>A</span>
                          <span className="text-xs">▼</span>
                        </button>
                        {showFontSizeDropdown && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 py-1 min-w-[120px]">
                            {[1, 2, 3, 4, 5, 6, 7].map((size) => (
                              <button
                                key={size}
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault()
                                  formatText('fontSize', size.toString())
                                  setShowFontSizeDropdown(false)
                                }}
                                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
                                style={{ fontSize: `${8 + size * 2}px` }}
                              >
                                Size {size}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      
                      {/* Color Picker */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowColorPicker(!showColorPicker)}
                          className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-900 dark:text-gray-100"
                          title="Text Color"
                        >
                          🎨
                        </button>
                        {showColorPicker && (
                          <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 p-3 w-56">
                            <div className="grid grid-cols-5 gap-2 mb-2">
                              {[
                                { name: 'Black', value: '#000000' },
                                { name: 'Red', value: '#EF4444' },
                                { name: 'Orange', value: '#F97316' },
                                { name: 'Yellow', value: '#EAB308' },
                                { name: 'Green', value: '#22C55E' },
                                { name: 'Blue', value: '#3B82F6' },
                                { name: 'Indigo', value: '#6366F1' },
                                { name: 'Purple', value: '#A855F7' },
                                { name: 'Pink', value: '#EC4899' },
                                { name: 'Gray', value: '#6B7280' },
                              ].map((color) => (
                                <button
                                  key={color.value}
                                  type="button"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    formatText('foreColor', color.value)
                                    setShowColorPicker(false)
                                  }}
                                  className="w-9 h-9 rounded border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform flex-shrink-0"
                                  style={{ backgroundColor: color.value }}
                                  title={color.name}
                                />
                              ))}
                            </div>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                formatText('removeFormat')
                                setShowColorPicker(false)
                              }}
                              className="w-full px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded text-sm text-gray-900 dark:text-gray-100 font-medium"
                            >
                              ✕ Remove Color
                            </button>
                          </div>
                        )}
                      </div>
                      
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
                      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          const url = prompt('Enter URL:', 'https://')
                          if (url) {
                            formatText('createLink', url)
                          }
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-blue-600 dark:text-blue-400"
                        title="Insert Link"
                      >
                        🔗 Link
                      </button>
                      <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          inlineImageInputRef.current?.click()
                        }}
                        className="px-3 py-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-green-600 dark:text-green-400"
                        title="Insert Image"
                      >
                        🖼️ Image
                      </button>
                      {/* Hidden file input for inline images */}
                      <input
                        ref={inlineImageInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const files = e.target.files
                          if (files) {
                            Array.from(files).forEach(file => insertImageIntoEditor(file))
                          }
                          e.target.value = ''
                        }}
                      />
                    </div>

                    {/* Rich Text Editor */}
                    <div className="flex gap-4">
                      <div className="flex-1 relative">
                        <div
                          ref={editorRef}
                          contentEditable
                          onInput={handleEditorInput}
                          onClick={handleEditorClick}
                          onDrop={handleEditorDrop}
                          onDragOver={(e) => e.preventDefault()}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 bg-white dark:bg-gray-800 min-h-[80px] max-h-[500px] overflow-y-auto prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100"
                          style={{ wordBreak: 'break-word', overflowWrap: 'break-word', wordWrap: 'break-word' }}
                        />
                        
                        {/* Inline Image Toolbar */}
                        {selectedImage && editingBlockId && (
                          <div 
                            className="image-toolbar"
                            style={{
                              position: 'absolute',
                              top: selectedImage.offsetTop - 48,
                              left: Math.min(Math.max(selectedImage.offsetLeft + selectedImage.offsetWidth / 2 - 180, 0), (editorRef.current?.offsetWidth || 400) - 360),
                            }}
                          >
                            <button
                              type="button"
                              className={imageWrap === 'left' ? 'active' : ''}
                              onClick={() => changeImageWrap('left')}
                              title="Float left - text wraps on right"
                            >
                              ⬅️ Left
                            </button>
                            <button
                              type="button"
                              className={imageWrap === 'right' ? 'active' : ''}
                              onClick={() => changeImageWrap('right')}
                              title="Float right - text wraps on left"
                            >
                              ➡️ Right
                            </button>
                            <button
                              type="button"
                              className={imageWrap === 'center' ? 'active' : ''}
                              onClick={() => changeImageWrap('center')}
                              title="Center - image on its own line, centered"
                            >
                              ⬜ Center
                            </button>
                            <button
                              type="button"
                              className={imageWrap === 'inline' ? 'active' : ''}
                              onClick={() => changeImageWrap('inline')}
                              title="Inline - image on its own line, left aligned"
                            >
                              📄 Block
                            </button>
                            <div className="separator" />
                            <button
                              type="button"
                              className={imageWrap === 'tight-left' ? 'active' : ''}
                              onClick={() => changeImageWrap('tight-left')}
                              title="Tight left - text follows image contour"
                            >
                              🔄 Tight L
                            </button>
                            <button
                              type="button"
                              className={imageWrap === 'tight-right' ? 'active' : ''}
                              onClick={() => changeImageWrap('tight-right')}
                              title="Tight right - text follows image contour"
                            >
                              🔄 Tight R
                            </button>
                            <div className="separator" />
                            <button
                              type="button"
                              onClick={deleteSelectedImage}
                              title="Delete image"
                              className="!text-red-400 hover:!bg-red-900"
                            >
                              🗑️
                            </button>
                          </div>
                        )}
                      </div>
                      
                      {/* Attachments management in edit mode */}
                      <div className="w-64 flex-shrink-0">
                        {/* Show existing attachments */}
                        {block.attachments.length > 0 && (
                          <div className="space-y-2 mb-2">
                            {block.attachments.map((attachment) => (
                              <div key={attachment.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                                {attachment.mimeType.startsWith('image/') ? (
                                  <img 
                                    src={`/api/files/${attachment.id}`}
                                    alt={attachment.filename}
                                    className="w-full h-24 object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-24 bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center">
                                    <span className="text-2xl mb-1">
                                      {attachment.mimeType.includes('pdf') ? '📄' :
                                       attachment.mimeType.includes('word') ? '📝' :
                                       attachment.mimeType.includes('excel') ? '📊' :
                                       '📎'}
                                    </span>
                                    <span className="text-xs text-gray-600 dark:text-gray-400 px-2 text-center truncate w-full">
                                      {attachment.filename}
                                    </span>
                                  </div>
                                )}
                                <button
                                  onClick={() => handleRemoveAttachment(block.id, attachment.id)}
                                  className="w-full bg-red-500 text-white text-xs py-1 hover:bg-red-600 transition-colors"
                                >
                                  🗑️ Remove
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Add more attachments */}
                        <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-500 transition-colors">
                          <span className="text-2xl mb-1">📎</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400">Add More</span>
                          <input
                            type="file"
                            multiple
                            className="hidden"
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
                            onChange={(e) => {
                              const files = e.target.files
                              if (files) {
                                Array.from(files).forEach(file => handleUploadToBlock(block.id, file))
                              }
                              e.target.value = ''
                            }}
                          />
                        </label>
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
                  <div className="flex flex-col gap-4">
                    {/* Text content */}
                    <div className="w-full">
                      <div
                        ref={(el) => { blockRefs.current[block.id] = el }}
                        onMouseUp={() => handleTextSelection(block.id)}
                        onClick={(e) => {
                          // Handle click on inline images in view mode
                          const target = e.target as HTMLElement
                          const inlineImage = target.closest('.inline-image')
                          if (inlineImage) {
                            const fileId = inlineImage.getAttribute('data-file-id')
                            if (fileId) {
                              // Find the file in attachments or create a preview object
                              const img = inlineImage.querySelector('img') as HTMLImageElement
                              if (img) {
                                setPreviewFile({
                                  id: fileId,
                                  filename: img.alt || 'Image',
                                  storedName: '',
                                  mimeType: 'image/jpeg',
                                  size: 0,
                                  path: img.src,
                                  createdAt: '',
                                  blockId: block.id,
                                })
                              }
                            }
                          }
                        }}
                        className="prose dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-gray-100 prose-p:text-gray-900 dark:prose-p:text-gray-100 cursor-text prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline"
                        style={{ wordBreak: 'break-word', overflowWrap: 'break-word', wordWrap: 'break-word' }}
                        dangerouslySetInnerHTML={{ __html: highlightSearchTerm(linkifyContent(block.content), highlightTerm) || '<p class="text-gray-400 dark:text-gray-500 italic">Empty block - click edit to add content</p>' }}
                      />
                    </div>
                    
                    {/* Attachments grid */}
                    {block.attachments.length > 0 && (
                      <div className="grid grid-cols-2 gap-4">
                        {block.attachments.map((attachment) => (
                          <div key={attachment.id} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 hover:border-blue-500 transition-colors">
                            {attachment.mimeType.startsWith('image/') ? (
                              <div 
                                onClick={() => setPreviewFile(attachment)}
                                className="cursor-pointer"
                              >
                                <img 
                                  src={`/api/files/${attachment.id}`}
                                  alt={attachment.filename}
                                  className="w-full h-40 object-cover"
                                />
                              </div>
                            ) : (
                              <div className="w-full bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center p-4">
                                <span className="text-4xl mb-2">
                                  {attachment.mimeType.includes('pdf') ? '📄' :
                                   attachment.mimeType.includes('word') ? '📝' :
                                   attachment.mimeType.includes('excel') || attachment.mimeType.includes('spreadsheet') ? '📊' :
                                   attachment.mimeType.includes('powerpoint') || attachment.mimeType.includes('presentation') ? '📽️' :
                                   '📎'}
                                </span>
                                <span className="text-xs text-gray-600 dark:text-gray-400 text-center truncate w-full mb-3">
                                  {attachment.filename}
                                </span>
                                <div className="flex gap-2">
                                  <a
                                    href={`/api/files/${attachment.id}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 transition-colors"
                                    title="Open file in new tab"
                                  >
                                    🔗 Open
                                  </a>
                                  <a
                                    href={`/api/files/${attachment.id}?download=true`}
                                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 transition-colors"
                                    title="Download file"
                                  >
                                    ⬇️ Download
                                  </a>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Action buttons */}
                    <div className="absolute -top-10 right-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}${window.location.pathname}#${pageId}:${block.id}`
                          navigator.clipboard.writeText(url)
                          alert('Link copied to clipboard!')
                        }}
                        className="bg-gray-600 dark:bg-gray-500 text-white px-3 py-1 rounded text-xs font-medium hover:bg-gray-700 dark:hover:bg-gray-600 transition-colors"
                        title="Copy link to this block"
                      >
                        🔗 Link
                      </button>
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
        multiple
        onChange={handleFileSelected}
        className="hidden"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.md"
      />

      {/* File Preview Popup */}
      {previewFile && (() => {
        const allImages = getAllImages()
        const currentIndex = allImages.findIndex(img => img.id === previewFile.id)
        const showNav = allImages.length > 1 && currentIndex !== -1
        
        return (
          <div 
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-8"
            onClick={() => { setPreviewFile(null); setZoomLevel(100) }}
          >
            {/* Left arrow */}
            {showNav && (
              <button
                onClick={(e) => { e.stopPropagation(); navigatePreview('prev') }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full text-white text-2xl font-bold transition-colors z-10"
                title="Previous image (←)"
              >
                ‹
              </button>
            )}
            
            {/* Right arrow */}
            {showNav && (
              <button
                onClick={(e) => { e.stopPropagation(); navigatePreview('next') }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/20 hover:bg-white/30 rounded-full text-white text-2xl font-bold transition-colors z-10"
                title="Next image (→)"
              >
                ›
              </button>
            )}

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
            className="flex items-center justify-center max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            {previewFile.mimeType.startsWith('image/') ? (
              <img 
                src={previewFile.path} 
                alt={previewFile.filename}
                className="max-w-[calc(100vw-200px)] max-h-[calc(100vh-200px)] object-contain"
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
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
                <p className="text-xl text-gray-900 dark:text-gray-100 mb-2">{previewFile.filename}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                  {(previewFile.size / 1024).toFixed(1)} KB
                </p>
                <div className="flex gap-4 justify-center">
                  <a
                    href={`/api/files/${previewFile.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    🔗 Open in New Tab
                  </a>
                  <a
                    href={`/api/files/${previewFile.id}?download=true`}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    ⬇️ Download
                  </a>
                </div>
              </div>
            )}
          </div>
          
            {/* Filename at bottom */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/20 px-4 py-2 rounded-lg">
              <span className="text-white text-sm">
                {previewFile.filename}
                {showNav && ` (${currentIndex + 1}/${allImages.length})`}
              </span>
            </div>
          </div>
        )
      })()}

      {/* Floating Toolbar - Always rendered, visibility controlled via style */}
      <div
        ref={floatingToolbarRef}
        data-floating-toolbar
        className="fixed z-50 flex gap-1 p-2 bg-gray-900 dark:bg-gray-100 rounded-lg shadow-xl border border-gray-700 dark:border-gray-300"
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
        
        {/* Font Size Controls */}
        <div className="flex items-center gap-1 border-l border-gray-600 dark:border-gray-400 pl-2 ml-1">
          {/* Decrease font size */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const currentSize = getCurrentFontSize()
              const newSize = Math.max(1, currentSize - 1).toString()
              applyFloatingFormat('fontSize', newSize)
            }}
            className="px-2 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded text-white dark:text-gray-900 text-xs"
            title="Decrease font size"
          >
            A-
          </button>
          
          {/* Increase font size */}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              const currentSize = getCurrentFontSize()
              const newSize = Math.min(7, currentSize + 1).toString()
              applyFloatingFormat('fontSize', newSize)
            }}
            className="px-2 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded text-white dark:text-gray-900 text-xs"
            title="Increase font size"
          >
            A+
          </button>
          
          {/* Font size dropdown */}
          <div className="relative inline-block">
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setShowFontSizeDropdown(!showFontSizeDropdown)
              }}
              className="px-2 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded text-white dark:text-gray-900 text-xs flex items-center gap-1"
              title="Font Size"
            >
              <span className="text-[10px]">▼</span>
            </button>
            
            {showFontSizeDropdown && (
              <div
                className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-2 min-w-[120px] z-50"
                onMouseDown={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                }}
              >
                {[
                  { size: '1', label: 'Tiny' },
                  { size: '2', label: 'Small' },
                  { size: '3', label: 'Normal' },
                  { size: '4', label: 'Medium' },
                  { size: '5', label: 'Large' },
                  { size: '6', label: 'Huge' },
                  { size: '7', label: 'Massive' },
                ].map(({ size, label }) => (
                  <button
                    key={size}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      applyFloatingFormat('fontSize', size)
                      setShowFontSizeDropdown(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-900 dark:text-gray-100 text-sm"
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        {/* Text Color Button */}
        <div className="relative inline-block">
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setShowColorPicker(!showColorPicker)
            }}
            className="px-3 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded text-white dark:text-gray-900 text-sm flex items-center gap-1"
            title="Text Color"
          >
            <span className="font-bold">A</span>
            <span className="text-xs">▼</span>
          </button>
          
          {showColorPicker && (
            <div
              className="absolute top-full mt-2 left-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl p-3 grid grid-cols-5 gap-2 min-w-[200px]"
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                { color: '#000000', name: 'Black' },
                { color: '#EF4444', name: 'Red' },
                { color: '#F97316', name: 'Orange' },
                { color: '#EAB308', name: 'Yellow' },
                { color: '#22C55E', name: 'Green' },
                { color: '#3B82F6', name: 'Blue' },
                { color: '#8B5CF6', name: 'Purple' },
                { color: '#EC4899', name: 'Pink' },
                { color: '#64748B', name: 'Gray' },
                { color: '#FFFFFF', name: 'White' },
              ].map(({ color, name }) => (
                <button
                  key={color}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    applyFloatingFormat('foreColor', color)
                    // Don't close picker - let user try different colors
                  }}
                  className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  title={name}
                />
              ))}
              
              {/* Reset to default */}
              <button
                type="button"
                onMouseDown={async (e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  
                  const selectedBlockId = selectedBlockIdRef.current
                  if (!selectedBlockId) return
                  
                  const blockRef = blockRefs.current[selectedBlockId]
                  if (!blockRef) return
                  
                  // Get just the text content without any HTML tags
                  const textContent = blockRef.textContent || blockRef.innerText
                  
                  // Replace with plain text
                  blockRef.innerHTML = textContent
                  
                  // Save to database
                  try {
                    const response = await fetch(`/api/blocks/${selectedBlockId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content: textContent }),
                    })
                    
                    if (response.ok) {
                      const updated = await response.json()
                      setPage(page && {
                        ...page,
                        blocks: page.blocks.map(b => b.id === selectedBlockId ? updated : b),
                      })
                    }
                  } catch (error) {
                    console.error('Error removing color:', error)
                  }
                  
                  // Re-select the text
                  setTimeout(() => {
                    blockRef.contentEditable = 'true'
                    const selection = window.getSelection()
                    if (selection) {
                      const range = document.createRange()
                      range.selectNodeContents(blockRef)
                      selection.removeAllRanges()
                      selection.addRange(range)
                      savedRangeRef.current = range.cloneRange()
                    }
                    blockRef.contentEditable = 'false'
                  }, 10)
                }}
                className="col-span-5 mt-2 px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
                title="Remove color"
              >
                Remove Color
              </button>
            </div>
          )}
        </div>
        
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault()
            e.stopPropagation()
            const url = prompt('Enter URL:', 'https://')
            if (url && savedRangeRef.current) {
              const selection = window.getSelection()
              if (selection) {
                selection.removeAllRanges()
                selection.addRange(savedRangeRef.current)
                document.execCommand('createLink', false, url)
                // Save changes to block
                const blockId = selectedBlockIdRef.current
                if (blockId) {
                  const blockRef = blockRefs.current[blockId]
                  if (blockRef) {
                    const content = blockRef.innerHTML
                    fetch(`/api/blocks/${blockId}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ content }),
                    })
                  }
                }
              }
            }
            hideFloatingToolbar()
          }}
          className="px-3 py-1 hover:bg-gray-700 dark:hover:bg-gray-300 rounded text-blue-400 dark:text-blue-600 text-sm"
          title="Insert Link"
        >
          🔗
        </button>
      </div>
    </div>
  )
}