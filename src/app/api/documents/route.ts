import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET all documents
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search')
    const parentId = searchParams.get('parentId')

    const documents = await prisma.document.findMany({
      where: search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              { blocks: { some: { content: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : parentId === 'null' || parentId === null
        ? { parentId: null }
        : parentId
        ? { parentId }
        : undefined,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(documents)
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
