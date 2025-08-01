"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Calendar, Folder, RefreshCw, HardDrive, Plus } from "lucide-react"

const FILE_TYPES = [
  { value: "pdf", label: "PDF Documents (.pdf)" },
  { value: "xlsx", label: "Excel Spreadsheets (.xlsx)" },
  { value: "docx", label: "Word Documents (.docx)" },
  { value: "pptx", label: "PowerPoint Presentations (.pptx)" },
  { value: "jpg", label: "JPEG Images (.jpg)" },
  { value: "png", label: "PNG Images (.png)" },
  { value: "zip", label: "ZIP Archives (.zip)" },
  { value: "csv", label: "CSV Files (.csv)" },
  { value: "all", label: "All File Types" },
]

interface GmailFolder {
  id: string
  name: string
  messagesTotal: number
  messagesUnread: number
  threadsTotal: number
  threadsUnread: number
}

interface DriveFolder {
  id: string
  name: string
  parents?: string[]
  createdTime: string
  modifiedTime: string
}

interface FileTypeSelectorProps {
  selectedFileType: string;
  setSelectedFileType: (val: string) => void;
  fileNameFilter: string;
  setFileNameFilter: (val: string) => void;
  dateFrom: string;
  setDateFrom: (val: string) => void;
  dateTo: string;
  setDateTo: (val: string) => void;
  selectedFolder: string;
  setSelectedFolder: (val: string) => void;
  selectedDriveFolder: string;
  setSelectedDriveFolder: (val: string) => void;
}

export function FileTypeSelector({
  selectedFileType,
  setSelectedFileType,
  fileNameFilter,
  setFileNameFilter,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  selectedFolder,
  setSelectedFolder,
  selectedDriveFolder,
  setSelectedDriveFolder,
}: FileTypeSelectorProps) {
  const [gmailFolders, setGmailFolders] = useState<GmailFolder[]>([])
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingPrefs, setIsLoadingPrefs] = useState(true)
  const [isLoadingFolders, setIsLoadingFolders] = useState(false)
  const [isLoadingDriveFolders, setIsLoadingDriveFolders] = useState(false)
  const [isCreatingFolder, setIsCreatingFolder] = useState(false)
  const { toast } = useToast()

  // Set default date to 30 days ago
  useEffect(() => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    setDateFrom(thirtyDaysAgo.toISOString().split("T")[0])
  }, [])

  useEffect(() => {
    // Load existing preferences and folders
    const loadData = async () => {
      try {
        // Load preferences
        const prefsResponse = await fetch("/api/preferences")
        if (prefsResponse.ok) {
          const { data } = await prefsResponse.json()
          if (data?.file_type) {
            setSelectedFileType(data.file_type)
          }
          if (data?.file_name_filter) {
            setFileNameFilter(data.file_name_filter)
          }
          if (data?.date_from) {
            setDateFrom(data.date_from.split("T")[0])
          }
          if (data?.gmail_folder) {
            setSelectedFolder(data.gmail_folder)
          }
          if (data?.drive_folder_id) {
            setSelectedDriveFolder(data.drive_folder_id)
          }
        }

        // Load Gmail folders and Drive folders
        await Promise.all([loadGmailFolders(), loadDriveFolders()])
      } catch (error) {
        console.error("Failed to load data:", error)
      } finally {
        setIsLoadingPrefs(false)
      }
    }

    loadData()
  }, [])

  const loadGmailFolders = async () => {
    setIsLoadingFolders(true)
    try {
      const response = await fetch("/api/gmail-folders")
      if (response.ok) {
        const { folders } = await response.json()
        setGmailFolders(folders || [])
      } else {
        const error = await response.json()
        toast({
          title: "Failed to load Gmail folders",
          description: error.error || "Please check your connection and try again",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to load Gmail folders:", error)
      toast({
        title: "Error loading folders",
        description: "Failed to fetch Gmail folders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingFolders(false)
    }
  }

  const loadDriveFolders = async () => {
    setIsLoadingDriveFolders(true)
    try {
      const response = await fetch("/api/drive-folders")
      if (response.ok) {
        const { folders } = await response.json()
        setDriveFolders(folders || [])
      } else {
        const error = await response.json()
        toast({
          title: "Failed to load Drive folders",
          description: error.error || "Please check your connection and try again",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Failed to load Drive folders:", error)
      toast({
        title: "Error loading Drive folders",
        description: "Failed to fetch Google Drive folders. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoadingDriveFolders(false)
    }
  }

  const createGmailAttachmentsFolder = async () => {
    setIsCreatingFolder(true)
    try {
      const response = await fetch("/api/create-drive-folder", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          folderName: "Gmail Attachments",
        }),
      })

      if (response.ok) {
        const { folder } = await response.json()
        setSelectedDriveFolder(folder.id)
        await loadDriveFolders() // Refresh the list
        toast({
          title: "Folder Created!",
          description: `Created "Gmail Attachments" folder in your Google Drive`,
        })
      } else {
        const error = await response.json()
        throw new Error(error.error || "Failed to create folder")
      }
    } catch (error) {
      console.error("Failed to create Drive folder:", error)
      toast({
        title: "Error creating folder",
        description: error instanceof Error ? error.message : "Failed to create Drive folder",
        variant: "destructive",
      })
    } finally {
      setIsCreatingFolder(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedFileType) {
      toast({
        title: "Error",
        description: "Please select a file type",
        variant: "destructive",
      })
      return
    }

    if (!dateFrom) {
      toast({
        title: "Error",
        description: "Please select a start date",
        variant: "destructive",
      })
      return
    }

    if (!selectedFolder) {
      toast({
        title: "Error",
        description: "Please select a Gmail folder",
        variant: "destructive",
      })
      return
    }

    if (!selectedDriveFolder) {
      toast({
        title: "Error",
        description: "Please select a Google Drive folder",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/preferences", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileType: selectedFileType,
          fileNameFilter: fileNameFilter.trim(),
          dateFrom: dateFrom,
          dateTo: dateTo, // <-- Add this line
          gmailFolder: selectedFolder,
          driveFolderId: selectedDriveFolder,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success!",
          description: "Your download preferences have been saved.",
        })
      } else {
        throw new Error("Failed to save preferences")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save your preferences. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoadingPrefs) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Download Preferences</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  const selectedFolderInfo = gmailFolders.find((folder) => folder.id === selectedFolder)
  const selectedDriveFolderInfo = driveFolders.find((folder) => folder.id === selectedDriveFolder)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Download Preferences</CardTitle>
        <CardDescription>Configure what files to download from Gmail and where to store them in Drive</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="file-type">File Type</Label>
            <Select value={selectedFileType} onValueChange={setSelectedFileType}>
              <SelectTrigger>
                <SelectValue placeholder="Select a file type" />
              </SelectTrigger>
              <SelectContent>
                {FILE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>


          <div className="space-y-2">
            <Label htmlFor="date-from">Download From Date</Label>
            <div className="relative">
              <Input
                id="date-from"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
              />
              {/* <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> */}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="date-to">Download To Date</Label>
            <div className="relative">
              <Input
                id="date-to"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                min={dateFrom}
                max={new Date().toISOString().split("T")[0]}
              />
              {/* <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" /> */}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="gmail-folder">Gmail Folder</Label>
            <Button
              variant="ghost"
              size="sm"
              onClick={loadGmailFolders}
              disabled={isLoadingFolders}
              className="h-6 px-2"
            >
              {isLoadingFolders ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          <Select value={selectedFolder} onValueChange={setSelectedFolder} disabled={isLoadingFolders}>
            <SelectTrigger>
              <SelectValue placeholder={isLoadingFolders ? "Loading folders..." : "Select a Gmail folder"} />
            </SelectTrigger>
            <SelectContent>
              {gmailFolders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  <div className="flex items-center space-x-2">
                    <Folder className="h-4 w-4" />
                    <span>{folder.name}</span>
                    <span className="text-xs text-muted-foreground">({folder.messagesTotal} messages)</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedFolderInfo && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedFolderInfo.name} - {selectedFolderInfo.messagesTotal} total messages,{" "}
              {selectedFolderInfo.messagesUnread} unread
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="drive-folder">Google Drive Destination</Label>
            <div className="flex gap-2">
              {/* <Button
                variant="ghost"
                size="sm"
                onClick={createGmailAttachmentsFolder}
                disabled={isCreatingFolder}
                className="h-6 px-2"
              >
                {isCreatingFolder ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              </Button> */}
              <Button
                variant="ghost"
                size="sm"
                onClick={loadDriveFolders}
                disabled={isLoadingDriveFolders}
                className="h-6 px-2"
              >
                {isLoadingDriveFolders ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3" />
                )}
              </Button>
            </div>
          </div>
          <Select value={selectedDriveFolder} onValueChange={setSelectedDriveFolder} disabled={isLoadingDriveFolders}>
            <SelectTrigger>
              <SelectValue placeholder={isLoadingDriveFolders ? "Loading Drive folders..." : "Select a Drive folder"} />
            </SelectTrigger>
            <SelectContent>
              {driveFolders.map((folder) => (
                <SelectItem key={folder.id} value={folder.id}>
                  <div className="flex items-center space-x-2">
                    <HardDrive className="h-4 w-4" />
                    <span>{folder.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(folder.modifiedTime).toLocaleDateString()}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedDriveFolderInfo && (
            <p className="text-xs text-muted-foreground">
              Selected: {selectedDriveFolderInfo.name} - Last modified:{" "}
              {new Date(selectedDriveFolderInfo.modifiedTime).toLocaleDateString()}
            </p>
          )}
          {/* <p className="text-xs text-muted-foreground">
            💡 Tip: Click the + button to create a new "Gmail Attachments" folder
          </p> */}
        </div>

        <div className="space-y-2">
          <Label htmlFor="file-name-filter">File Name Filter (Optional)</Label>
          <Input
            id="file-name-filter"
            type="text"
            placeholder="Enter keywords to filter file names (e.g., invoice, report, contract)"
            value={fileNameFilter}
            onChange={(e) => setFileNameFilter(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Only files containing any of the keywords in their name will be downloaded. Separate keywords with spaces (e.g., invoice receipt bill). Leave empty to download all files of the selected type.
          </p>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isLoading || !selectedFileType || !dateFrom || !selectedFolder || !selectedDriveFolder}
          className="w-full"
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Preferences
        </Button>

        <div className="text-xs text-muted-foreground bg-blue-50 p-3 rounded-lg">
          <p className="font-medium mb-1">Current Settings:</p>
          <p>• File Type: {selectedFileType ? FILE_TYPES.find((t) => t.value === selectedFileType)?.label : "None"}</p>
          <p>• Gmail Folder: {selectedFolderInfo?.name || "None"}</p>
          <p>• Drive Folder: {selectedDriveFolderInfo?.name || "None"}</p>
          <p>• Date Range: {dateFrom ? `From ${new Date(dateFrom).toLocaleDateString()}` : "Not set"} {dateTo ? `To ${new Date(dateTo).toLocaleDateString()}` : "Not set"}</p>
          <p>• Name Filter: {fileNameFilter || "None (all files)"}</p>
        </div>
      </CardContent>
    </Card>
  )
}
