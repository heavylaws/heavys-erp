import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Building2, Save, Loader2 } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { insertCompanySettingsSchema, type CompanySettings } from "@shared/schema";

type CompanySettingsFormValues = z.infer<typeof insertCompanySettingsSchema>;

export function OrganizationSettings() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: settings, isLoading } = useQuery<CompanySettings>({
        queryKey: ['/api/settings/company'],
    });

    const form = useForm<CompanySettingsFormValues>({
        resolver: zodResolver(insertCompanySettingsSchema),
        defaultValues: {
            name: "Highway Cafe",
            address: "",
            phone: "",
            email: "",
            website: "",
            taxId: "",
            receiptHeader: "Welcome!",
            receiptFooter: "Thank you for your visit!",
        },
    });

    useEffect(() => {
        if (settings) {
            form.reset({
                name: settings.name || "Highway Cafe",
                address: settings.address || "",
                phone: settings.phone || "",
                email: settings.email || "",
                website: settings.website || "",
                taxId: settings.taxId || "",
                receiptHeader: settings.receiptHeader || "Welcome!",
                receiptFooter: settings.receiptFooter || "Thank you for your visit!",
            });
        }
    }, [settings, form]);

    const mutation = useMutation({
        mutationFn: async (values: CompanySettingsFormValues) => {
            const res = await fetch('/api/settings/company', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(values),
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || 'Failed to save settings');
            }

            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/settings/company'] });
            toast({
                title: "Settings Saved",
                description: "Organization details have been updated successfully.",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to save settings. Please try again.",
                variant: "destructive",
            });
            console.error(error);
        },
    });

    const onSubmit = (values: CompanySettingsFormValues) => {
        mutation.mutate(values);
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Organization Details
                </CardTitle>
                <CardDescription>
                    Manage your business identity, contact information, and receipt details.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Business Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. My Awesome Shop" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            This name will be displayed on the login screen and receipts.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="taxId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Tax ID / VAT Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Tax Registration Number" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email Address</FormLabel>
                                        <FormControl>
                                            <Input type="email" placeholder="contact@business.com" {...field} value={field.value || ''} />
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
                                        <FormLabel>Phone Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+1 234 567 890" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="website"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Website</FormLabel>
                                        <FormControl>
                                            <Input placeholder="https://..." {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="address"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Business Address</FormLabel>
                                    <FormControl>
                                        <Textarea placeholder="123 Main St, City, Country" {...field} value={field.value || ''} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t">
                            <FormField
                                control={form.control}
                                name="receiptHeader"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Receipt Header Message</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Welcome!" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormDescription>Text to appear at the top of receipts.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="receiptFooter"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Receipt Footer Message</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Thank you!" {...field} value={field.value || ''} />
                                        </FormControl>
                                        <FormDescription>Text to appear at the bottom of receipts.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={mutation.isPending}>
                                {mutation.isPending ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
