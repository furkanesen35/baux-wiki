'use client'

import { useState } from 'react'

interface UploadFormProps {
  parentId?: string | null
  parentTitle?: string | null
}

export default function UploadForm({ parentId = null, parentTitle = null }: UploadFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const formData = new FormData()
      formData.append('title', title)
      if (parentId) {
        formData.append('parentId', parentId)
      }

      const response = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      })

      if (response.ok) {
        setTitle('')
        setIsOpen(false)
        window.location.reload()
      } else {
        alert('Failed to create page')
      }
    } catch (error) {
      console.error('Error:', error)
      alert('Error creating page')
    } finally {
      setLoading(false)
    }
  }

  const buttonText = parentTitle ? `➕ Add Subpage to "${parentTitle}"` : '➕ New Page'
  const headerText = parentTitle ? `Create Subpage under "${parentTitle}"` : 'Create New Page'

  return (
    <div className="relative">
      <button
        className="bg-blue-600 dark:bg-blue-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors whitespace-nowrap"
        onClick={() => setIsOpen(!isOpen)}
      >
        {buttonText}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{headerText}</h2>
              <button
                className="text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 p-2 rounded text-2xl w-8 h-8 flex items-center justify-center"
                onClick={() => setIsOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="font-medium text-gray-900 dark:text-gray-100">Page Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Enter page title..."
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-base focus:outline-none focus:border-blue-600 dark:focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                />
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  The page will be created empty. You can add content blocks after creation.
                </p>
              </div>

              <div className="flex gap-4 justify-end mt-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 rounded-md text-base font-medium bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-md text-base font-medium bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Creating...' : parentTitle ? 'Create Subpage' : 'Create Page'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
