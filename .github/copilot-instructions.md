# Baux Wiki - Local Company Wiki

## Project Overview
A local wiki website for company document management with upload functionality. Built with Next.js, Prisma, PostgreSQL, and React in a monorepo structure with BFF (Backend for Frontend) pattern.

## Tech Stack
- Frontend: Next.js 14+ with React and TypeScript
- Backend: Next.js API Routes (BFF pattern) + Express (if needed)
- Database: PostgreSQL with Prisma ORM
- Architecture: Monorepo structure with backend inside frontend
- Styling: Tailwind CSS with Typography plugin
- Storage: PostgreSQL database + local file system
- Document format: Markdown support

## Development Guidelines
- Use TypeScript for type safety - NO `any` types allowed
- Properly type all variables with specific types (string, number, boolean, etc.)
- Follow Next.js App Router conventions
- Use Prisma for database operations
- Implement API routes as BFF layer
- Keep backend logic within Next.js API routes
- Use React components for UI
- Use Tailwind CSS for styling (no CSS modules)
