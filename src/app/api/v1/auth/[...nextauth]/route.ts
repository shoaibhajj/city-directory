// src/app/api/v1/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

// Auth.js v5 exports GET and POST handlers directly
export const { GET, POST } = handlers;
