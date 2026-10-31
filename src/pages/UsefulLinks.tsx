import { useState, useMemo } from 'react';
import { Plus, Search, Edit2, Trash2, Link2, ExternalLink, Copy } from 'lucide-react';
import { useAppStore, useUsefulLinks } from '../stores/useAppStore';
import { UsefulLink } from '../types';
import { PageHeader, Button, Modal, FormField, Input, Textarea, ConfirmDialog, EmptyState } from '../components/ui';
import { normalizeUrl } from '../utils';
import { useIsDubai } from '../hooks';

const PLACEHOLDERS = {
  dubai: {
    url: 'e.g. https://www.dewa.gov.ae',
    title: 'e.g. DEWA Bill Payment (defaults to the site name)',
    description: 'e.g. Pay electricity & water bill. Account no. is on the bill.',
  },
  india: {
    url: 'e.g. https://www.incometax.gov.in',
    title: 'e.g. Income Tax e-Filing (defaults to the site name)',
    description: 'e.g. File ITR before 31 July. Login with PAN.',
  },
};

const defaultForm = () => ({ title: '', url: '', description: '' });

const hostnameOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

export default function UsefulLinks() {
  const links = useUsefulLinks();
  const { addUsefulLink, updateUsefulLink, deleteUsefulLink, pushToast } = useAppStore();
  const placeholders = PLACEHOLDERS[useIsDubai() ? 'dubai' : 'india'];

  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm());
  const [urlError, setUrlError] = useState('');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return links;
    return links.filter(l =>
      l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q) || l.description.toLowerCase().includes(q)
    );
  }, [links, search]);

  const openAdd = () => { setForm(defaultForm()); setUrlError(''); setEditId(null); setModalOpen(true); };
  const openEdit = (l: UsefulLink) => {
    setForm({ title: l.title, url: l.url, description: l.description });
    setUrlError('');
    setEditId(l.id);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const url = normalizeUrl(form.url);
    if (!url) { setUrlError('Enter a valid web address, e.g. https://example.com'); return; }
    // Title is optional in the form — fall back to the site's hostname.
    const payload = { title: form.title.trim() || hostnameOf(url), url, description: form.description.trim() };
    if (editId) await updateUsefulLink(editId, payload);
    else await addUsefulLink(payload);
    setModalOpen(false);
  };

  const copyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      pushToast('Link copied', 'success');
    } catch {
      pushToast('Could not copy the link', 'error');
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Useful Links"
        subtitle={`${links.length} saved link${links.length === 1 ? '' : 's'}`}
        action={<Button onClick={openAdd}><Plus size={16} /> Add Link</Button>}
      />

      {links.length > 0 && (
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <Input placeholder="Search by title, URL or notes..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8" />
        </div>
      )}

      {links.length === 0 ? (
        <EmptyState icon={<Link2 size={40} />} title="No links yet" description="Save the sites you use often, like bill payments, bank logins, visa status or insurance portals, with a note for each." />
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Search size={40} />} title="No matching links" description={`Nothing matches "${search.trim()}".`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(link => (
            <div key={link.id} className="card group flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#6366F1]/15 text-[#6366F1] flex items-center justify-center">
                    <Link2 size={14} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold text-primary text-sm truncate" title={link.title}>{link.title}</h3>
                    <p className="text-xs text-muted truncate" title={link.url}>{hostnameOf(link.url)}</p>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => copyUrl(link.url)} className="p-1 text-muted hover:text-primary" title="Copy URL"><Copy size={12} /></button>
                  <button onClick={() => openEdit(link)} className="p-1 text-muted hover:text-primary" title="Edit"><Edit2 size={12} /></button>
                  <button onClick={() => setDeleteId(link.id)} className="p-1 text-muted hover:text-red-400" title="Delete"><Trash2 size={12} /></button>
                </div>
              </div>

              {link.description && (
                <p className="text-xs text-muted whitespace-pre-line line-clamp-3 mb-3">{link.description}</p>
              )}

              <a
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:underline"
              >
                <ExternalLink size={12} /> Open link
              </a>
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editId ? 'Edit Link' : 'Add Link'}>
        <div className="space-y-4">
          <FormField label="URL" error={urlError}>
            <Input
              value={form.url}
              onChange={e => { setForm(f => ({ ...f, url: e.target.value })); setUrlError(''); }}
              placeholder={placeholders.url}
              autoFocus
            />
          </FormField>
          <FormField label="Title">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={placeholders.title} />
          </FormField>
          <FormField label="Description / Notes">
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder={placeholders.description} />
          </FormField>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? 'Update' : 'Save'} Link</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteId && deleteUsefulLink(deleteId)}
        title="Delete Link"
        message="Are you sure you want to delete this link?"
      />
    </div>
  );
}
