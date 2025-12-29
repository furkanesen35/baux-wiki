import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

// GET file with proper filename
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const download = searchParams.get('download') === 'true'

    // Find file in database
    const file = await prisma.uploadedFile.findUnique({
      where: { id: params.id },
    })

    if (!file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      )
    }

    // Build file path
    const filePath = path.join(process.cwd(), 'public', file.path)

    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'File not found on disk' },
        { status: 404 }
      )
    }

    // Read file
    const fileBuffer = await readFile(filePath)

    // Determine if file can be viewed inline in browser
    const inlineViewable = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/pdf',
      'text/plain',
      'text/html',
    ]
    
    const canViewInline = inlineViewable.includes(file.mimeType)

    // Set headers for proper filename
    // Use attachment for download=true OR for files that can't be viewed inline
    const forceDownload = download || !canViewInline
    const disposition = forceDownload
      ? `attachment; filename="${file.filename}"`
      : `inline; filename="${file.filename}"`

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': file.mimeType,
        'Content-Disposition': disposition,
        'Content-Length': file.size.toString(),
      },
    })
  } catch (error) {
    console.error('Error serving file:', error)
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    )
  }
}
