import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Trash2, Download, RotateCcw, Save, AlertTriangle, Cloud, UploadCloud, Check, RefreshCw } from "lucide-react";
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
import { useState } from "react";

interface BackupFile {
    name: string;
    size: number;
    created_at: string;
}

interface BackupConfig {
    autoBackupEnabled: boolean;
    schedule: string;
    hasServiceAccount: boolean;
    lastCloudBackup?: string;
    driveFolderId?: string;
}

export function AdminBackupPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [uploadingKey, setUploadingKey] = useState(false);

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

    const createBackupMutation = useMutation({
        mutationFn: async () => {
            await apiRequest('POST', '/api/admin/backups', {});
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/admin/backups'] });
            toast({ title: "Backup created", description: "Database has been backed up successfully." });
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
            // Reset input
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
            toast({ title: "Restore successful", description: "Database restored. You may need to refresh the page." });
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
        <div className="container mx-auto py-8 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">System Backups</h1>
                    <p className="text-muted-foreground mt-1">
                        Manage database backups and cloud synchronization.
                    </p>
                </div>
                <Button
                    onClick={() => createBackupMutation.mutate()}
                    disabled={createBackupMutation.isPending}
                >
                    {createBackupMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    Create Manual Backup
                </Button>
            </div>

            {/* Cloud Backup Configuration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-2">
                        <Cloud className="h-5 w-5 text-sky-600" />
                        <CardTitle>Google Drive Auto-Backup</CardTitle>
                    </div>
                    <CardDescription>
                        Configure automated daily backups to Google Drive.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Status & Toggle */}
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                                <div className="space-y-0.5">
                                    <Label className="text-base">Auto-Backup Enabled</Label>
                                    <div className="text-sm text-muted-foreground">
                                        Backs up daily at {config?.schedule}
                                    </div>
                                </div>
                                <Switch
                                    checked={config?.autoBackupEnabled || false}
                                    onCheckedChange={(checked) => updateConfigMutation.mutate({ autoBackupEnabled: checked })}
                                    disabled={!config?.hasServiceAccount || updateConfigMutation.isPending}
                                />
                            </div>

                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <span className="font-medium">Status:</span>
                                {config?.hasServiceAccount ? (
                                    <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200 gap-1">
                                        <Check className="h-3 w-3" /> Service Account Configured
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-amber-600 bg-amber-50 border-amber-200">
                                        No Service Account
                                    </Badge>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="key-upload">Update Service Account Key (JSON)</Label>
                                <div className="flex gap-2 mt-1.5">
                                    <Input
                                        id="key-upload"
                                        type="file"
                                        accept=".json"
                                        onChange={handleKeyUpload}
                                        disabled={uploadingKey}
                                        className="cursor-pointer"
                                    />
                                    {uploadingKey && <Loader2 className="h-9 w-9 animate-spin text-muted-foreground" />}
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => testConnectionMutation.mutate()}
                                    disabled={!config?.hasServiceAccount || testConnectionMutation.isPending}
                                >
                                    {testConnectionMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <RefreshCw className="h-3 w-3 mr-2" />}
                                    Test Connection
                                </Button>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => triggerCloudMutation.mutate()}
                                    disabled={!config?.hasServiceAccount || triggerCloudMutation.isPending}
                                >
                                    {triggerCloudMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <UploadCloud className="h-3 w-3 mr-2" />}
                                    Trigger Cloud Backup
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Available Backups</CardTitle>
                    <CardDescription>
                        List of all manual and automatic backups stored on the server.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : !backups?.length ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No backups found. Create one to get started.
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
                                        <TableCell className="font-mono text-sm">{file.name}</TableCell>
                                        <TableCell>{formatSize(file.size)}</TableCell>
                                        <TableCell>{format(new Date(file.created_at), 'PPP pp')}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    asChild
                                                >
                                                    <a href={`/api/admin/backups/${file.name}`} download>
                                                        <Download className="h-4 w-4" />
                                                    </a>
                                                </Button>

                                                <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="outline" size="sm" className="text-amber-600 hover:text-amber-700">
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
                                                                This will <strong>OVERWRITE</strong> the current database. All data created after this backup will be lost.
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
                                                        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader>
                                                            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
                                                            <AlertDialogDescription>
                                                                Are you sure you want to delete <strong>{file.name}</strong>?
                                                                This action cannot be undone.
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
    );
}
