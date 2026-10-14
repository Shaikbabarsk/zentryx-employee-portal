import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 proxy entry point. Authenticated route checks are performed in the app;
// Supabase Row Level Security remains the database authorization boundary.
export default function proxy(_request: NextRequest) {
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
