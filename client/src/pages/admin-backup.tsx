import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, Download, RotateCcw, Save, AlertTriangle, Cloud, UploadCloud, Check, RefreshCw, FolderOpen, Clock, Image as ImageIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useState, useEffect } from "react";
import { Separator } from "@/components/ui/separator";

interface BackupFile {
    name: string;
    size: number;
    created_at: string;
}

interface BackupConfig {
    autoBackupEnabled: boolean;
    schedule: string;
    localBackupPath?: string;
    includeUploads: boolean;
    hasServiceAccount: boolean;
    lastCloudBackup?: string;
    driveFolderId?: string;
    hasOAuth?: boolean;
    hasUserAuth?: boolean;
}

export function AdminBackupPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [uploadingKey, setUploadingKey] = useState(false);

    // Local state for form inputs to avoid jumpy UI on every keystroke
    const [localPath, setLocalPath] = useState("");
    const [scheduleTime, setScheduleTime] = useState("");

    const { data: backups, isLoading } = useQuery<BackupFile[]>({
        queryKey: ['/api/admin/backups'],
        queryFn: async () => {
            const res = await fetch('/api/admin/backups');
            if (!res.ok) throw new Error("Failed to fetch backups");
            return res.json();
        }
    });

    const { data: config, isLoading: isLoadingConfig } = useQuery<BackupConfig>({
        queryKey: ['/api/admin/backup/config'],
        queryFn: async () => {
            const res = await fetch('/api/admin/backup/config');
            if (!res.ok) throw new Error("Failed to fetch config");
            return res.json();
        }
    });

    // innovative: Sync local state when config loads
    useEffect(() => {
        if (config) {
            setLocalPath(config.localBackupPath || "");
            setScheduleTime(config.schedule || "02:00");
        }
    }, [config]);

    const createBackupMutation = useMutation({
        mutationFn: async () => {
            await apiRequest('POST', '/api/admin/backups', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
            toast({ title: "Backup created", description: "System has been backed up successfully." });
        },
        onError: (error: any) => {
            toast({ title: "Backup failed", description: error.message, variant: "destructive" });
        }
    });

    const triggerCloudMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest('POST', '/api/admin/backup/trigger-cloud', {});
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backup/config'] });
            toast({ title: "Cloud Backup Triggered", description: `Backup ${data.filename} uploaded to Drive.` });
        },
        onError: (error: any) => {
            toast({ title: "Cloud Backup failed", description: error.message, variant: "destructive" });
        }
    });

    const updateConfigMutation = useMutation({
        mutationFn: async (newConfig: Partial<BackupConfig>) => {
            await apiRequest('POST', '/api/admin/backup/config', newConfig);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backup/config'] });
            toast({ title: "Settings updated" });
        },
        onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
    });

    const handleBlurUpdate = () => {
        if (!config) return;
        if (localPath !== config.localBackupPath || scheduleTime !== config.schedule) {
            updateConfigMutation.mutate({
                localBackupPath: localPath,
                schedule: scheduleTime
            });
        }
    };

    const testConnectionMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest('POST', '/api/admin/backup/test-drive', {});
            return res.json();
        },
        onSuccess: (data) => {
            toast({ title: "Connection Successful", description: `Access Code: ${data.status} (OK)` });
        },
        onError: (e: any) => toast({ title: "Connection Failed", description: e.message, variant: "destructive" }),
    });

    const handleKeyUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length) return;
        const file = e.target.files[0];
        const formData = new FormData();
        formData.append('key', file);

        setUploadingKey(true);
        try {
            const res = await fetch('/api/admin/backup/upload-key', {
                method: 'POST',
                body: formData,
            });
            if (!res.ok) throw new Error((await res.json()).message);

            queryClient.invalidateQueries({ queryKey: ['/api/admin/backup/config'] });
            toast({ title: "Key Uploaded", description: "Service account key saved successfully." });
        } catch (error: any) {
            toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
        } finally {
            setUploadingKey(false);
            e.target.value = '';
        }
    };

    const deleteMutation = useMutation({
        mutationFn: async (filename: string) => {
            await apiRequest('DELETE', `/api/admin/backups/${filename}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
            toast({ title: "Backup deleted" });
        },
        onError: (error: any) => {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        }
    });

    const restoreMutation = useMutation({
        mutationFn: async (filename: string) => {
            await apiRequest('POST', `/api/admin/backups/${filename}/restore`, {});
        },
        onSuccess: () => {
            toast({ title: "Restore successful", description: "System restored. You may need to refresh the page." });
            setTimeout(() => window.location.reload(), 1500);
        },
        onError: (error: any) => {
            toast({ title: "Restore failed", description: error.message, variant: "destructive" });
        }
    });

    const formatSize = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="container mx-auto py-8 space-y-8 max-w-5xl">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Backups</h1>
                    <p className="text-muted-foreground mt-1">
                        Configure local paths, schedules, and cloud synchronization.
                    </p>
                </div>
                <Button
                    onClick={() => createBackupMutation.mutate()}
                    disabled={createBackupMutation.isPending}
                    className="gap-2"
                >
                    {createBackupMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    Backup Now
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Settings */}
                <div className="lg:col-span-2 space-y-8">
                    {/* General Settings */}
                    <Card>
                        <CardHeader>
                            <div className="flex items-center gap-2">
                                <Clock className="h-5 w-5 text-primary" />
                                <CardTitle>Backup Schedule & Location</CardTitle>
                            </div>
                            <CardDescription>
                                Configure where and when backups are saved locally.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {/* Local Path */}
                                <div className="space-y-2 md:col-span-2">
                                    <Label htmlFor="localPath" className="flex items-center gap-2">
                                        <FolderOpen className="h-4 w-4" />
                                        Local Backup Folder Path
                                    </Label>
                                    <Input
                                        id="localPath"
                                        placeholder="/home/user/Google Drive/HeavysBackups"
                                        value={localPath}
                                        onChange={(e) => setLocalPath(e.target.value)}
                                        onBlur={handleBlurUpdate}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Enter the absolute path to your Google Drive or Dropbox folder to enable auto-sync.
                                        Leave empty to use the default internal folder.
                                    </p>
                                </div>

                                {/* Schedule Time */}
                                <div className="space-y-2">
                                    <Label htmlFor="scheduleTime" className="flex items-center gap-2">
                                        <Clock className="h-4 w-4" />
                                        Daily Backup Time
                                    </Label>
                                    <Input
                                        id="scheduleTime"
                                        type="time"
                                        value={scheduleTime}
                                        onChange={(e) => setScheduleTime(e.target.value)}
                                        onBlur={handleBlurUpdate}
                                    />
                                </div>

                                {/* Auto Backup Toggle */}
                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                    <div className="space-y-0.5">
                                        <Label className="text-base">Automatic Backup</Label>
                                        <p className="text-xs text-muted-foreground">Runs daily at specified time</p>
                                    </div>
                                    <Switch
                                        checked={config?.autoBackupEnabled || false}
                                        onCheckedChange={(checked) => updateConfigMutation.mutate({ autoBackupEnabled: checked })}
                                    />
                                </div>
                            </div>

                            <Separator />

                            {/* Content Settings */}
                            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
                                <div className="space-y-0.5">
                                    <Label className="text-base flex items-center gap-2">
                                        <ImageIcon className="h-4 w-4" />
                                        Include Uploads & Images
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Include product images and receipts in the backup zip
                                    </p>
                                </div>
                                <Switch
                                    checked={config?.includeUploads || false}
                                    onCheckedChange={(checked) => updateConfigMutation.mutate({ includeUploads: checked })}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Available Backups List */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Backup History</CardTitle>
                            <CardDescription>
                                List of recent backups stored on the server.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                                </div>
                            ) : !backups?.length ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    No backups found.
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Filename</TableHead>
                                            <TableHead>Size</TableHead>
                                            <TableHead>Created At</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {backups.map((file) => (
                                            <TableRow key={file.name}>
                                                <TableCell className="font-mono text-sm max-w-[200px] truncate" title={file.name}>{file.name}</TableCell>
                                                <TableCell>{formatSize(file.size)}</TableCell>
                                                <TableCell className="text-nowrap">{format(new Date(file.created_at), 'MMM d, HH:mm')}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-1">
                                                        <Button variant="ghost" size="icon" asChild title="Download">
                                                            <a href={`/api/admin/backups/${file.name}`} download>
                                                                <Download className="h-4 w-4" />
                                                            </a>
                                                        </Button>

                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="text-amber-600 hover:text-amber-700 hover:bg-amber-50" title="Restore">
                                                                    <RotateCcw className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                                                                        <AlertTriangle className="h-5 w-5" />
                                                                        Confirm Restore
                                                                    </AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Are you sure you want to restore from <strong>{file.name}</strong>?
                                                                        <br /><br />
                                                                        This will <strong>OVERWRITE</strong> the current database.
                                                                        <br />
                                                                        This action cannot be undone.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => restoreMutation.mutate(file.name)}
                                                                        className="bg-destructive hover:bg-destructive/90"
                                                                    >
                                                                        Restore Database
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>

                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" title="Delete">
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Permanently delete <strong>{file.name}</strong>?
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => deleteMutation.mutate(file.name)}
                                                                        className="bg-destructive hover:bg-destructive/90"
                                                                    >
                                                                        Delete
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Cloud Settings */}
                <div className="space-y-6">
                    {/* New: User Mode Sync */}
                    <Card className="border-primary/20 bg-primary/5">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-primary">
                                <UploadCloud className="h-5 w-5" />
                                <CardTitle className="text-base">Google Drive (User Mode)</CardTitle>
                            </div>
                            <CardDescription>
                                Connect your personal Drive to store backups (Free 15GB).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 text-sm">
                                <span className="font-medium">Status:</span>
                                {config?.hasUserAuth ? (
                                    <Badge className="bg-green-600 hover:bg-green-700 gap-1">
                                        <Check className="h-3 w-3" /> Connected
                                    </Badge>
                                ) : config?.hasOAuth ? (
                                    <Badge variant="secondary" className="text-amber-600 bg-amber-50">
                                        Ready to Connect
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Setup Required</Badge>
                                )}
                            </div>

                            {!config?.hasUserAuth && (
                                <div className="space-y-3">
                                    <div className="text-xs text-muted-foreground p-2 bg-background rounded border">
                                        1. Create OAuth Credentials in Google Cloud Console.<br />
                                        2. Download JSON and upload below.<br />
                                        3. Click Connect.
                                    </div>

                                    <div>
                                        <Label htmlFor="oauth-upload" className="text-xs font-semibold">Step 1: Upload Client JSON</Label>
                                        <Input
                                            id="oauth-upload"
                                            type="file"
                                            accept=".json"
                                            onChange={async (e) => {
                                                if (!e.target.files?.length) return;
                                                const file = e.target.files[0];
                                                const formData = new FormData();
                                                formData.append('key', file);

                                                try {
                                                    const res = await fetch('/api/admin/backup/upload-oauth-client', {
                                                        method: 'POST',
                                                        body: formData,
                                                    });
                                                    if (!res.ok) throw new Error((await res.json()).message);

                                                    queryClient.invalidateQueries({ queryKey: ['/api/admin/backup/config'] });
                                                    toast({ title: "OAuth Client Saved", description: "Now click Connect to login." });
                                                } catch (error: any) {
                                                    toast({ title: "Upload Failed", description: error.message, variant: "destructive" });
                                                }
                                            }}
                                            className="h-9 text-xs mt-1"
                                        />
                                    </div>

                                    <Button
                                        onClick={async () => {
                                            try {
                                                const res = await fetch('/api/admin/backup/auth-url');
                                                if (!res.ok) throw new Error((await res.json()).message);
                                                const { url } = await res.json();
                                                window.location.href = url;
                                            } catch (error: any) {
                                                toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
                                            }
                                        }}
                                        disabled={!config?.hasOAuth}
                                        className="w-full gap-2"
                                        size="sm"
                                    >
                                        <UploadCloud className="h-4 w-4" />
                                        Step 2: Connect Google Drive
                                    </Button>
                                </div>
                            )}

                            {config?.hasUserAuth && (
                                <div className="text-xs text-muted-foreground">
                                    <p>Backups will be uploaded to "Heavys Backups" in your personal Drive.</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Legacy Service Account */}
                    <Card className="bg-muted/10 border-dashed">
                        <CardHeader>
                            <div className="flex items-center gap-2 text-muted-foreground">
                                <Cloud className="h-4 w-4" />
                                <CardTitle className="text-base">Legacy Bot Mode</CardTitle>
                            </div>
                            <CardDescription>
                                Service Account (Requires Billing/Quota)
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">Status:</span>
                                {config?.hasServiceAccount ? (
                                    <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1">
                                        <Check className="h-3 w-3" /> Configured
                                    </Badge>
                                ) : (
                                    <Badge variant="outline">Not Configured</Badge>
                                )}
                            </div>

                            <div>
                                <Label htmlFor="key-upload" className="text-xs">Update Bot Key (JSON)</Label>
                                <div className="flex gap-2 mt-1">
                                    <Input
                                        id="key-upload"
                                        type="file"
                                        accept=".json"
                                        onChange={handleKeyUpload}
                                        disabled={uploadingKey}
                                        className="h-9 text-xs"
                                    />
                                </div>
                            </div>

                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => testConnectionMutation.mutate()}
                                disabled={!config?.hasServiceAccount || testConnectionMutation.isPending}
                            >
                                Test Bot Connection
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
