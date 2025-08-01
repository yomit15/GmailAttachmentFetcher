"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, ExternalLink, Search } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Log {
  id: string
  user_email: string
  file_name: string
  file_type: string
  status: string
  drive_file_id: string | null
  drive_link: string | null
  search_query: string | null
  created_at: string
}

interface LogsTableProps {
  userEmail: string
  dateTo: string
}

export function LogsTable({ userEmail, dateTo }: LogsTableProps) {
  const [logs, setLogs] = useState<Log[]>([])
  const [filteredLogs, setFilteredLogs] = useState<Log[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  const refreshLogs = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/logs?date_to=${dateTo}`)
      if (response.ok) {
        const { data } = await response.json()
        setLogs(data || [])
        setFilteredLogs(data || [])
      }
    } catch (error) {
      console.error("Failed to fetch logs:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/logs?date_to=${dateTo}`)
        if (response.ok) {
          const { data } = await response.json()
          setLogs(data || [])
          setFilteredLogs(data || [])
        }
      } catch (error) {
        console.error("Failed to fetch logs:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchLogs()
  }, [userEmail, dateTo])

  useEffect(() => {
    if (searchTerm) {
      const filtered = logs.filter((log) => log.file_name.toLowerCase().includes(searchTerm.toLowerCase()))
      setFilteredLogs(filtered)
    } else {
      setFilteredLogs(logs)
    }
  }, [searchTerm, logs])

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download Logs</CardTitle>
          <CardDescription>Loading your download history...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Download Logs</CardTitle>
          <CardDescription>View your recent Gmail attachment downloads and Drive uploads</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={refreshLogs} disabled={isLoading}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </Button>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">No download logs found</p>
            <p className="text-sm text-muted-foreground mt-2">
              Downloads will appear here once you start using the download feature
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              {searchTerm && (
                <Badge variant="secondary">
                  {filteredLogs.length} of {logs.length} files
                </Badge>
              )}
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Drive Link</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium max-w-xs truncate" title={log.file_name}>
                      {log.file_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.file_type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>{log.status}</Badge>
                    </TableCell>
                    <TableCell>
                      {log.drive_link ? (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={log.drive_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">-</span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(log.created_at).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
