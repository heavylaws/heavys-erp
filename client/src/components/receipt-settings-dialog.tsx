import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { insertReceiptSettingsSchema, InsertReceiptSettings, ReceiptSettings } from "@shared/schema";
import { Settings, Loader2 } from "lucide-react";
import { useState } from "react";
import { apiRequest } from "@/lib/queryClient";

export function ReceiptSettingsDialog() {
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<ReceiptSettings>({
        queryKey: ['/api/settings/receipt'],
    });

    const form = useForm<InsertReceiptSettings>({
        resolver: zodResolver(insertReceiptSettingsSchema),
        defaultValues: {
            businessName: '',
            address: '',
            phone: '',
            headerText: '',
            footerText: '',
            ...settings, // Pre-fill with fetched data
        },
        values: settings ? { // Update form when data loads
            businessName: settings.businessName,
            address: settings.address,
            phone: settings.phone,
            headerText: settings.headerText,
            footerText: settings.footerText,
        } : undefined
    });

    const mutation = useMutation({
        mutationFn: async (data: InsertReceiptSettings) => {
            const res = await apiRequest("PUT", "/api/settings/receipt", data);
            return res.json();
        },
        onSuccess: (updatedSettings) => {
            queryClient.setQueryData(['/api/settings/receipt'], updatedSettings);
            toast({
                title: "Settings Saved",
                description: "Receipt settings have been updated.",
            });
            setOpen(false);
        },
        onError: (error) => {
            console.error(error);
            let description = "Failed to update settings.";

            // Try to extract useful error message
            if (error instanceof Error) {
                // The apiRequest helper throws "Status: Message", e.g. "400: {...}"
                const match = error.message.match(/^\d+: (.*)/);
                if (match) {
                    try {
                        const errorData = JSON.parse(match[1]);
                        if (errorData.message) {
                            description = errorData.message;
                            // If there are Zod errors, append the first one for context
                            if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
                                const details = errorData.errors.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ');
                                description += ` (${details})`;
                            }
                        }
                    } catch (e) {
                        // Fallback if not JSON
                        description = match[1];
                    }
                } else {
                    description = error.message;
                }
            }

            toast({
                title: "Error",
                description: description,
                variant: "destructive",
            });
        },
    });

    function onSubmit(data: InsertReceiptSettings) {
        // Only send editable fields to avoid schema validation errors with system fields (id, updatedAt)
        const updateData = {
            businessName: data.businessName,
            address: data.address,
            phone: data.phone,
            headerText: data.headerText,
            footerText: data.footerText,
        };
        mutation.mutate(updateData as any);
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="sm" title="Receipt Settings">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Receipt Settings</DialogTitle>
                    <DialogDescription>
                        Customize the content that appears on printed receipts.
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <FormField
                                control={form.control}
                                name="businessName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Business Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Highway Cafe" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="address"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address</FormLabel>
                                            <FormControl>
                                                <Input placeholder="123 Main St" {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="phone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="555-0123" {...field} value={field.value || ''} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="headerText"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Header Text</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Receipt" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="footerText"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Footer Text</FormLabel>
                                        <FormControl>
                                            <Textarea placeholder="Thank you for your business!" {...field} value={field.value || ''} className="resize-none h-20" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <DialogFooter>
                                <Button type="submit" disabled={mutation.isPending}>
                                    {mutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}
