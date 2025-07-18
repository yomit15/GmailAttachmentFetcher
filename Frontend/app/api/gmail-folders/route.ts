import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { google } from "googleapis"
export { dynamic } from "@/lib/dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Fetching Gmail folders for:", session.user.email)

    // Get user's tokens from Supabase
    const { data: userData, error: userError } = await supabaseAdmin
      .from("users")
      .select("access_token, refresh_token, token_expires_at")
      .eq("email", session.user.email)
      .single()

    if (userError || !userData) {
      console.error("User fetch error:", userError)
      return NextResponse.json({ error: "User not found. Please sign in again." }, { status: 400 })
    }

    if (!userData.access_token) {
      return NextResponse.json(
        {
          error: "No access token found. Please sign out and sign in again to reconnect your Gmail account.",
        },
        { status: 401 },
      )
    }

    // Check if token is expired and refresh if needed
    let currentAccessToken = userData.access_token
    if (userData.token_expires_at) {
      const tokenExpiresAt = new Date(userData.token_expires_at)
      const now = new Date()

      if (tokenExpiresAt <= now && userData.refresh_token) {
        console.log("Token expired, refreshing...")
        const refreshResult = await refreshUserToken(session.user.email, userData.refresh_token)
        if (!refreshResult.success) {
          return NextResponse.json(
            {
              error: "Token expired and refresh failed. Please sign out and sign in again.",
            },
            { status: 401 },
          )
        }
        currentAccessToken = refreshResult.accessToken
      }
    }

    // Initialize Gmail API
    const oauth2Client = new google.auth.OAuth2()
    oauth2Client.setCredentials({ access_token: currentAccessToken })

    const gmail = google.gmail({ version: "v1", auth: oauth2Client })

    // Test Gmail API access
    try {
      const profile = await gmail.users.getProfile({ userId: "me" })
      console.log("Gmail profile:", profile.data)
      
      const labels = await gmail.users.labels.list({ userId: "me" })
      console.log("Labels response:", labels.data)
    } catch (error) {
      console.error("Gmail API test failed:", error)
    }

    // Fetch Gmail labels (folders)
    const labelsResponse = await gmail.users.labels.list({
      userId: "me",
    })

    console.log("=== GMAIL LABELS DEBUG ===")
    console.log("Labels response status:", labelsResponse.status)
    console.log("Labels response data:", JSON.stringify(labelsResponse.data, null, 2))

    const labels = labelsResponse.data.labels || []
    const labelDetails = await Promise.all(
      labels.map(async (label) => {
        const detail = await gmail.users.labels.get({ userId: "me", id: label.id })
        return {
          id: label.id,
          name: label.name,
          messagesTotal: detail.data.messagesTotal || 0,
          messagesUnread: detail.data.messagesUnread || 0,
        }
      })
    )
    console.log("Label details with counts:", labelDetails)

    // Filter and format labels for user-friendly display
    const folders = labelDetails
      .filter((label) => {
        // Include system labels and user-created labels
        return (
          label.id &&
          label.name &&
          // Exclude some system labels that are not useful for file downloads
          ![
            "DRAFT",
            "SPAM",
            "TRASH",
            "CHAT",
            "CATEGORY_PERSONAL",
            "CATEGORY_SOCIAL",
            "CATEGORY_PROMOTIONS",
            "CATEGORY_UPDATES",
            "CATEGORY_FORUMS",
          ].includes(label.id)
        )
      })
      .map((label) => ({
        id: label.id!,
        name: getFriendlyLabelName(label.name!, label.id!),
        messagesTotal: label.messagesTotal || 0,
        messagesUnread: label.messagesUnread || 0,
        threadsTotal: label.threadsTotal || 0,
        threadsUnread: label.threadsUnread || 0,
      }))
      .sort((a, b) => {
        // Sort by importance: INBOX first, then by message count, then alphabetically
        if (a.id === "INBOX") return -1
        if (b.id === "INBOX") return 1
        if (a.messagesTotal !== b.messagesTotal) return b.messagesTotal - a.messagesTotal
        return a.name.localeCompare(b.name)
      })

    console.log(`Found ${folders.length} Gmail folders`)

    return NextResponse.json({
      success: true,
      folders,
      totalFolders: folders.length,
    })
  } catch (error) {
    console.error("Gmail folders fetch error:", error)
    return NextResponse.json({ error: "Failed to fetch Gmail folders. Please try again." }, { status: 500 })
  }
}

// Helper function to refresh user token
async function refreshUserToken(email: string, refreshToken: string) {
  try {
    console.log("Refreshing token for user:", email)

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })

    const refreshedTokens = await response.json()

    if (!response.ok) {
      console.error("Token refresh failed:", refreshedTokens)
      return { success: false }
    }

    const newExpiresAt = new Date(Date.now() + refreshedTokens.expires_in * 1000)

    // Update tokens in Supabase
    const { error } = await supabaseAdmin
      .from("users")
      .update({
        access_token: refreshedTokens.access_token,
        refresh_token: refreshedTokens.refresh_token || refreshToken,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("email", email)

    if (error) {
      console.error("Error updating refreshed tokens:", error)
      return { success: false }
    }

    console.log("Successfully refreshed and updated tokens")
    return { success: true, accessToken: refreshedTokens.access_token }
  } catch (error) {
    console.error("Error refreshing token:", error)
    return { success: false }
  }
}

// Helper function to convert Gmail label names to user-friendly names
function getFriendlyLabelName(labelName: string, labelId: string): string {
  const friendlyNames: { [key: string]: string } = {
    INBOX: "📥 Inbox",
    SENT: "📤 Sent",
    IMPORTANT: "⭐ Important",
    STARRED: "⭐ Starred",
    UNREAD: "📬 Unread",
    DRAFT: "📝 Drafts",
    SPAM: "🚫 Spam",
    TRASH: "🗑️ Trash",
    CATEGORY_PERSONAL: "👤 Personal",
    CATEGORY_SOCIAL: "👥 Social",
    CATEGORY_PROMOTIONS: "🏷️ Promotions",
    CATEGORY_UPDATES: "🔄 Updates",
    CATEGORY_FORUMS: "💬 Forums",
  }

  // Return friendly name if available, otherwise return the original name with folder icon
  return friendlyNames[labelId] || `📁 ${labelName}`
}
