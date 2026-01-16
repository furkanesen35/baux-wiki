import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// PUT update block
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body: unknown = await request.json()
    
    if (!body || typeof body !== 'object' || body === null) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      )
    }

    const { content, type, order } = body as {
      content?: string
      type?: string
      order?: number
    }

    const block = await prisma.contentBlock.update({
      where: { id: params.id },
      data: {
        ...(content !== undefined && { content }),
        ...(type !== undefined && { type }),
        ...(order !== undefined && { order }),
      },
      include: {
        attachments: true,
      },
    })

    return NextResponse.json(block)
  } catch (error) {
    console.error('Error updating block:', error)
    return NextResponse.json(
      { error: 'Failed to update block' },
      { status: 500 }
    )
  }
}

// DELETE block
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.contentBlock.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting block:', error)
    return NextResponse.json(
      { error: 'Failed to delete block' },
      { status: 500 }
    )
  }
}
