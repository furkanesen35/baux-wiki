# Baux Wiki - Local Company Wiki

A modern, local wiki website for managing company documents and preventing work duplication. Built with Next.js, React, Prisma, and PostgreSQL.

## Features
- 📝 Upload and manage documents
- 🔍 Search functionality
- 📄 Markdown support with preview
- 🏠 Local-only (runs on your network)
- 🎨 Modern, responsive interface
- 🗃️ PostgreSQL database storage
- 🔒 Type-safe with TypeScript

## Prerequisites
- Node.js 18+ 
- PostgreSQL installed and running

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up the database:
```bash
# Copy environment variables
cp .env.example .env

# Update DATABASE_URL in .env with your PostgreSQL connection string
# Example: DATABASE_URL="postgresql://user:password@localhost:5432/baux_wiki"

# Run Prisma migrations
npx prisma migrate dev
```

## Usage

1. Start the development server:
```bash
npm run dev
```

2. Open your browser and navigate to:
```
http://localhost:3000
```

3. Start uploading and managing your documents!

## Project Structure
```
baux-wiki/
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── api/            # API Routes (BFF layer)
│   │   ├── page.tsx        # Home page
│   │   └── layout.tsx      # Root layout
│   ├── components/         # React components
│   ├── lib/                # Utilities and Prisma client
│   └── types/              # TypeScript types
├── prisma/
│   └── schema.prisma       # Database schema
├── public/                 # Static files
├── uploads/                # Document storage
└── package.json
```

## Tech Stack
- **Frontend**: Next.js 14 + React + TypeScript
- **Backend**: Next.js API Routes (BFF pattern)
- **Database**: PostgreSQL + Prisma ORM
- **Architecture**: Monorepo with backend inside frontend
- **Styling**: Tailwind CSS with Typography plugin
- **Type Safety**: Full TypeScript with strict mode (no `any` types)

## Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npx prisma studio` - Open Prisma Studio (database GUI)

## License
MIT
