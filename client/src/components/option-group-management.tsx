import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ChevronDown, ChevronRight, Plus, X } from 'lucide-react';

interface OptionGroupForm {
  name: string;
  description?: string;
  selectionType: 'single' | 'multiple';
  minSelections: number;
  maxSelections: number;
  required: boolean;
}

// Child component that safely encapsulates the options query so that
// hooks are not called conditionally inside a loop in the parent.
function GroupOptions({
  groupId,
  expanded,
  onEditOption,
  onDeleteOption,
  queryClient
}: {
  groupId: string;
  expanded: boolean;
  onEditOption: (opt: any) => void;
  onDeleteOption: (id: string) => void;
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  // Only mount the hook when expanded to satisfy Rules of Hooks
  const { data, isLoading, error } = useQuery({
    queryKey: ['/api/option-groups', groupId, 'options'],
    enabled: expanded,
    queryFn: async () => {
      const res = await fetch(`/api/option-groups/${groupId}/options`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load options');
      return res.json();
    }
  });

  if (!expanded) return null;
  if (isLoading) return <p className="text-xs text-gray-500">Loading options…</p>;
  if (error) return <p className="text-xs text-red-600">Failed to load options</p>;

  const list = data || [];
  if (!list.length) return <p className="text-xs text-gray-500">No options yet.</p>;

  return (
    <ul className="space-y-1 mt-3 border-t pt-3">
      {list.map((opt: any) => (
        <li key={opt.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded px-2 py-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-gray-800">{opt.name}</span>
              {opt.isDefault && <span className="text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">default</span>}
              {!opt.isActive && <span className="text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded">inactive</span>}
              {opt.priceAdjust && opt.priceAdjust !== '0' && <span className="text-xs text-gray-500">+{opt.priceAdjust}</span>}
              <span className="text-xs text-gray-400">order {opt.displayOrder}</span>
            </div>
            {opt.description && <p className="text-xs text-gray-500 truncate max-w-md">{opt.description}</p>}
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => onEditOption(opt)}>Edit</Button>
            <Button size="sm" variant="destructive" onClick={() => { if (confirm('Delete option?')) onDeleteOption(opt.id); }}>Del</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function OptionGroupManagement() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<OptionGroupForm>({
    name: '',
    description: '',
    selectionType: 'single',
    minSelections: 0,
    maxSelections: 1,
    required: false
  });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [optionDialog, setOptionDialog] = useState<{ open: boolean; groupId: string | null; optionId?: string | null; form: any }>({ open: false, groupId: null, optionId: null, form: { name: '', description: '', priceAdjust: '0', isDefault: false, isActive: true, displayOrder: 0 } });

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['/api/option-groups'],
    queryFn: async () => {
      const res = await fetch('/api/option-groups', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load option groups');
      return res.json();
    }
  });

  const resetForm = () => {
    setForm({ name: '', description: '', selectionType: 'single', minSelections: 0, maxSelections: 1, required: false });
    setEditingId(null);
  };

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, minSelections: Number(form.minSelections), maxSelections: Number(form.maxSelections) } as any;
      // backend expects 'required'
      const method = editingId ? 'PATCH' : 'POST';
      const url = editingId ? `/api/option-groups/${editingId}` : '/api/option-groups';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Request failed');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: editingId ? 'Option Group Updated' : 'Option Group Created' });
      qc.invalidateQueries({ queryKey: ['/api/option-groups'] });
      setOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/option-groups/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: () => {
      toast({ title: 'Option Group Deleted' });
      qc.invalidateQueries({ queryKey: ['/api/option-groups'] });
    },
    onError: (err: any) => toast({ title: 'Delete failed', description: err.message, variant: 'destructive' })
  });

  const startEdit = (g: any) => {
    setEditingId(g.id);
    setForm({
      name: g.name || '',
      description: g.description || '',
      selectionType: g.selectionType || 'single',
      minSelections: g.minSelections ?? 0,
      maxSelections: g.maxSelections ?? 1,
      required: !!g.required
    });
    setOpen(true);
  };

  const toggleExpand = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // Removed dynamic per-group hook calls to comply with Rules of Hooks.

  const saveOptionMutation = useMutation({
    mutationFn: async () => {
      const { groupId, optionId, form } = optionDialog;
      if (!groupId) throw new Error('No group');
      const payload: any = { ...form, optionGroupId: groupId, priceAdjust: form.priceAdjust?.toString?.() || '0', displayOrder: Number(form.displayOrder || 0) };
      const method = optionId ? 'PATCH' : 'POST';
      const url = optionId ? `/api/options/${optionId}` : '/api/options';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error(await res.text() || 'Failed to save option');
      return res.json();
    },
    onSuccess: (_, __) => {
      toast({ title: optionDialog.optionId ? 'Option Updated' : 'Option Created' });
      if (optionDialog.groupId) qc.invalidateQueries({ queryKey: ['/api/option-groups', optionDialog.groupId, 'options'] });
      setOptionDialog({ open: false, groupId: null, optionId: null, form: { name: '', description: '', priceAdjust: '0', isDefault: false, isActive: true, displayOrder: 0 } });
    },
    onError: (e: any) => toast({ title: 'Option save failed', description: e.message, variant: 'destructive' })
  });

  const deleteOptionMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/options/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('Delete failed');
    },
    onSuccess: (_, id: any) => {
      toast({ title: 'Option deleted' });
      // Find which group query to invalidate by scanning loaded queries
  // Invalidate all loaded group option queries
  qc.invalidateQueries({ queryKey: ['/api/option-groups'] });
    },
    onError: (e: any) => toast({ title: 'Option delete failed', description: e.message, variant: 'destructive' })
  });

  const validate = () => {
    if (!form.name.trim()) return 'Name required';
    if (form.minSelections < 0) return 'Min cannot be negative';
    if (form.maxSelections < form.minSelections) return 'Max must be >= Min';
    if (form.required && form.minSelections === 0) return 'Required groups should have minSelections >= 1';
    return null;
  };

  const error = validate();

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <CardTitle className="flex items-center gap-2">Option Groups</CardTitle>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button size="sm" variant="default" onClick={() => { resetForm(); setOpen(true); }}>New Group</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Edit Option Group' : 'Create Option Group'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Milk Type" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Description</label>
                <Input value={form.description} onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional description" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Selection Type</label>
                  <select className="border rounded px-2 py-1 w-full" value={form.selectionType} onChange={(e) => setForm(f => ({ ...f, selectionType: e.target.value as any }))}>
                    <option value="single">Single</option>
                    <option value="multiple">Multiple</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <input id="required" type="checkbox" className="h-4 w-4" checked={form.required} onChange={(e) => setForm(f => ({ ...f, required: e.target.checked }))} />
                  <label htmlFor="required" className="text-sm font-medium">Required</label>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Min Selections</label>
                  <Input type="number" value={form.minSelections} onChange={(e) => setForm(f => ({ ...f, minSelections: Number(e.target.value) }))} />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Max Selections</label>
                  <Input type="number" value={form.maxSelections} onChange={(e) => setForm(f => ({ ...f, maxSelections: Number(e.target.value) }))} />
                </div>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button disabled={!!error || upsertMutation.isPending} onClick={() => upsertMutation.mutate()}>Save</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-gray-500">Loading groups...</p>
        ) : groups.length === 0 ? (
          <p className="text-sm text-gray-500">No option groups yet.</p>
        ) : (
          <div className="space-y-2">
            {groups.map((g: any) => (
              <div key={g.id} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={() => toggleExpand(g.id)} className="p-1 rounded hover:bg-gray-100 transition">
                        {expanded[g.id] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </button>
                      <span className="font-medium text-gray-900">{g.name}</span>
                      {g.required && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">required</span>}
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{g.selectionType}</span>
                      <span className="text-xs text-gray-500">{g.minSelections} - {g.maxSelections}</span>
                    </div>
                    {g.description && <p className="text-xs text-gray-600 mt-1 truncate max-w-md">{g.description}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(g)}>Edit</Button>
                    <Button size="sm" variant="destructive" onClick={() => { if (confirm('Delete this option group?')) deleteMutation.mutate(g.id); }}>Delete</Button>
                    <Button size="sm" onClick={() => setOptionDialog({ open: true, groupId: g.id, optionId: null, form: { name: '', description: '', priceAdjust: '0', isDefault: false, isActive: true, displayOrder: 0 } })}>Add Option</Button>
                  </div>
                </div>
                <GroupOptions
                  groupId={g.id}
                  expanded={!!expanded[g.id]}
                  queryClient={qc}
                  onEditOption={(opt) => setOptionDialog({ open: true, groupId: g.id, optionId: opt.id, form: { name: opt.name, description: opt.description, priceAdjust: opt.priceAdjust || '0', isDefault: !!opt.isDefault, isActive: !!opt.isActive, displayOrder: opt.displayOrder || 0 } })}
                  onDeleteOption={(id) => deleteOptionMutation.mutate(id)}
                />
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <Dialog open={optionDialog.open} onOpenChange={(o) => { if (!o) setOptionDialog({ open: false, groupId: null, optionId: null, form: { name: '', description: '', priceAdjust: '0', isDefault: false, isActive: true, displayOrder: 0 } }); else setOptionDialog(d => ({ ...d, open: true })); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{optionDialog.optionId ? 'Edit Option' : 'Add Option'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Name</label>
              <Input value={optionDialog.form.name} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, name: e.target.value } }))} />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Input value={optionDialog.form.description} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, description: e.target.value } }))} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Price Adjust</label>
                <Input type="number" value={optionDialog.form.priceAdjust} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, priceAdjust: e.target.value } }))} />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Display Order</label>
                <Input type="number" value={optionDialog.form.displayOrder} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, displayOrder: Number(e.target.value) } }))} />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input type="checkbox" id="opt-default" checked={optionDialog.form.isDefault} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, isDefault: e.target.checked } }))} />
                <label htmlFor="opt-default" className="text-sm font-medium">Default</label>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input type="checkbox" id="opt-active" checked={optionDialog.form.isActive} onChange={(e) => setOptionDialog(d => ({ ...d, form: { ...d.form, isActive: e.target.checked } }))} />
                <label htmlFor="opt-active" className="text-sm font-medium">Active</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOptionDialog({ open: false, groupId: null, optionId: null, form: { name: '', description: '', priceAdjust: '0', isDefault: false, isActive: true, displayOrder: 0 } })}>Cancel</Button>
              <Button disabled={!optionDialog.form.name || saveOptionMutation.isPending} onClick={() => saveOptionMutation.mutate()}>{optionDialog.optionId ? 'Update' : 'Create'}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
