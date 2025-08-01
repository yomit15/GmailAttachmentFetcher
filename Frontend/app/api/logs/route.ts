import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
export { dynamic } from "@/lib/dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // First, fetch the user's id from the users table using their email
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("id")
      .eq("email", session.user.email)
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get date_to from query params
    const { searchParams } = new URL(request.url)
    const dateTo = searchParams.get("date_to")

    let query = supabaseAdmin
      .from("logs")
      .select("*")
      .eq("user_id", userData.id)

    if (dateTo) {
      // Only include logs with created_at <= dateTo (end of day)
      const dateToEnd = dateTo + "T23:59:59.999Z"
      query = query.lte("created_at", dateToEnd)
    }

    query = query.order("created_at", { ascending: false }).limit(50)

    const { data, error } = await query

    if (error) {
      console.error("Supabase error:", error)
      return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error("API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

