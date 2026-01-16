import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST create new block
export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json()
    
    if (!body || typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { documentId, type, content, order } = body as {
      documentId?: string
      type?: string
      content?: string
      order?: number
    }

    if (!documentId || typeof documentId !== 'string' ||
        !type || typeof type !== 'string' ||
        content === undefined || typeof content !== 'string' ||
        order === undefined || typeof order !== 'number') {
      return NextResponse.json(
        { error: 'documentId, type, content, and order are required' },
        { status: 400 }
      )
    }

    const block = await prisma.contentBlock.create({
      data: {
        documentId,
        type,
        content,
        order,
      },
      include: {
        attachments: true,
      },
    })

    return NextResponse.json(block, { status: 201 })
  } catch (error) {
    console.error('Error creating block:', error)
    return NextResponse.json(
      { error: 'Failed to create block' },
      { status: 500 }
    )
  }
}
