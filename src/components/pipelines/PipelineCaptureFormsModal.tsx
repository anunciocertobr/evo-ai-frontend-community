import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/hooks/useLanguage';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Button,
} from '@evoapi/design-system';
import { Plus, Copy, Trash2, Edit, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { crmFormsService } from '@/services/crmForms/crmFormsService';
import { customAttributesService } from '@/services/customAttributes/customAttributesService';
import type { CrmForm, CrmFormPayload } from '@/types/crmForms';
import type { CustomAttributeDefinition } from '@/types/settings';
import type { Pipeline, PipelineStage } from '@/types/analytics';
import CrmFormModal from '@/components/crmForms/CrmFormModal';

interface PipelineCaptureFormsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipeline: Pipeline | null;
  stages: PipelineStage[];
  allPipelines: Pipeline[];
}

/**
 * "Formulários de Captura" for a single pipeline — opened from the board's ⋮ menu.
 * Lists the forms whose default destination is THIS pipeline and lets you
 * create/edit/delete + copy the public link, reusing the real CrmForm machinery
 * (crmFormsService + CrmFormModal builder). New forms preselect this pipeline.
 */
export default function PipelineCaptureFormsModal({
  open,
  onOpenChange,
  pipeline,
  allPipelines,
}: PipelineCaptureFormsModalProps) {
  const { t } = useLanguage('pipelines');

  const [forms, setForms] = useState<CrmForm[]>([]);
  const [loading, setLoading] = useState(false);
  const [contactAttrs, setContactAttrs] = useState<CustomAttributeDefinition[]>([]);
  const [dealAttrs, setDealAttrs] = useState<CustomAttributeDefinition[]>([]);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [editing, setEditing] = useState<CrmForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadForms = useCallback(async () => {
    if (!pipeline?.id) return;
    setLoading(true);
    try {
      const { data } = await crmFormsService.list({ pipelineId: pipeline.id });
      setForms(data);
    } catch {
      toast.error(t('captureForms.loadError'));
    } finally {
      setLoading(false);
    }
  }, [pipeline?.id, t]);

  // Load the builder's target selectors once (contact/deal custom attributes).
  const loadContext = useCallback(async () => {
    try {
      const [cAttrs, dAttrs] = await Promise.all([
        customAttributesService.getCustomAttributes('contact_attribute'),
        customAttributesService.getCustomAttributes('pipeline_item_attribute'),
      ]);
      setContactAttrs(cAttrs.data);
      setDealAttrs(dAttrs.data);
    } catch {
      /* selectors degrade to standard targets only */
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadForms();
      loadContext();
    }
  }, [open, loadForms, loadContext]);

  const openCreate = () => {
    setEditing(null);
    setBuilderOpen(true);
  };
  const openEdit = (form: CrmForm) => {
    setEditing(form);
    setBuilderOpen(true);
  };

  const handleSave = async (payload: CrmFormPayload) => {
    setSaving(true);
    try {
      if (editing) await crmFormsService.update(editing.id, payload);
      else await crmFormsService.create(payload);
      toast.success(t('captureForms.saved'));
      setBuilderOpen(false);
      loadForms();
    } catch (error: unknown) {
      const msg = (error as { response?: { data?: { error?: { message?: string } } } })?.response
        ?.data?.error?.message;
      toast.error(msg || t('captureForms.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (form: CrmForm) => {
    if (!window.confirm(t('captureForms.deleteConfirm', { name: form.name }))) return;
    setDeletingId(form.id);
    try {
      await crmFormsService.remove(form.id);
      toast.success(t('captureForms.deleted'));
      loadForms();
    } catch {
      toast.error(t('captureForms.deleteError'));
    } finally {
      setDeletingId(null);
    }
  };

  const copyLink = (form: CrmForm) => {
    const url = `${window.location.origin}/f/${form.id}`;
    navigator.clipboard?.writeText(url);
    toast.success(t('captureForms.linkCopied'));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              {t('captureForms.title')}
            </DialogTitle>
            <DialogDescription>
              {t('captureForms.subtitle', { pipeline: pipeline?.name ?? '' })}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end">
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('captureForms.newForm')}
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : forms.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-border rounded-xl">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/60 mb-2" />
                <p className="text-sm text-muted-foreground">{t('captureForms.empty')}</p>
                <Button variant="outline" size="sm" onClick={openCreate} className="mt-3">
                  <Plus className="h-4 w-4 mr-2" />
                  {t('captureForms.newForm')}
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {forms.map(form => (
                  <div
                    key={form.id}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground truncate">{form.name}</span>
                        <span
                          className={
                            form.published
                              ? 'text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary'
                              : 'text-[11px] font-bold px-2 py-0.5 rounded-md bg-muted text-muted-foreground'
                          }
                        >
                          {form.published
                            ? t('captureForms.published')
                            : t('captureForms.draft')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {t('captureForms.leadsCount', { count: form.leads_count ?? 0 })}
                        {' · '}
                        {form.slug}
                      </div>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => copyLink(form)}
                        title={t('captureForms.copyLink')}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={() => window.open(`/f/${form.id}`, '_blank')}
                        title={t('captureForms.openLink')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                        onClick={() => openEdit(form)}
                        title={t('captureForms.edit')}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(form)}
                        disabled={deletingId === form.id}
                        title={t('captureForms.delete')}
                      >
                        {deletingId === form.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reuse the real form builder. presetPipelineId preselects this pipeline on create. */}
      <CrmFormModal
        open={builderOpen}
        onClose={() => setBuilderOpen(false)}
        onSave={handleSave}
        saving={saving}
        initial={editing}
        pipelines={allPipelines}
        contactAttrs={contactAttrs}
        dealAttrs={dealAttrs}
        presetPipelineId={pipeline?.id}
      />
    </>
  );
}
