import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Helper function to recursively fetch all children
async function getDocumentWithChildren(parentId: string | null, depth: number = 0): Promise<any[]> {
  const maxDepth = 50 // Prevent infinite loops
  if (depth > maxDepth) return []

  const documents = await prisma.document.findMany({
    where: { parentId },
    include: {
      blocks: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Recursively fetch children for each document
  const documentsWithChildren = await Promise.all(
    documents.map(async (doc) => {
      const children = await getDocumentWithChildren(doc.id, depth + 1)
      return {
        ...doc,
        children,
      }
    })
  )

  return documentsWithChildren
}

// GET all documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')

    if (search) {
      // For search, return flat list with parent info
      const documents = await prisma.document.findMany({
        where: {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { blocks: { some: { content: { contains: search, mode: 'insensitive' } } } },
          ],
        },
        include: {
          parent: {
            select: {
              id: true,
              title: true,
            },
          },
          blocks: {
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      })
      return NextResponse.json(documents)
    }

    // For tree view, return hierarchical structure
    const rootDocuments = await getDocumentWithChildren(null)
    return NextResponse.json(rootDocuments)
  } catch (error) {
    console.error('Error fetching documents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    )
  }
}

// POST create new document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const title = formData.get('title')
    const parentId = formData.get('parentId')

    // Validate required fields
    if (!title || typeof title !== 'string') {
      return NextResponse.json(
        { error: 'Title is required and must be a string' },
        { status: 400 }
      )
    }

    const document = await prisma.document.create({
      data: {
        title,
        parentId: parentId && typeof parentId === 'string' && parentId !== '' ? parentId : null,
      },
      include: {
        children: {
          select: {
            id: true,
            title: true,
          },
        },
        blocks: {
          orderBy: { order: 'asc' },
        },
      },
    })

    return NextResponse.json(document, { status: 201 })
  } catch (error) {
    console.error('Error creating document:', error)
    return NextResponse.json(
      { error: 'Failed to create document' },
      { status: 500 }
    )
  }
}
