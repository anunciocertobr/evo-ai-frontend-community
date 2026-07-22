import React, { useState, useEffect } from 'react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@evoapi/design-system/dialog';
import { Button } from '@evoapi/design-system/button';
import { Input } from '@evoapi/design-system/input';
import { Label } from '@evoapi/design-system/label';
import { Textarea } from '@evoapi/design-system/textarea';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { scheduledActionsService } from '@/services/scheduledActions/scheduledActionsService';
import type { CreateScheduledAction } from '@/types/automation';
import { CHANNEL_TYPE_MAP } from '../../scheduledActions/scheduledActionChannelUtils';
import { useLanguage } from '@/hooks/useLanguage';

interface ScheduleMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | number;
  channelType?: string;
  /** The message currently typed in the composer — this is what gets scheduled. */
  messageContent: string;
}

const getMinDateTime = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const ScheduleMessageModal: React.FC<ScheduleMessageModalProps> = ({
  isOpen,
  onClose,
  conversationId,
  channelType,
  messageContent,
}) => {
  const { t } = useLanguage('chat');
  const [scheduledFor, setScheduledFor] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setScheduledFor('');
      setNote('');
      setErrors({});
    }
  }, [isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!scheduledFor) {
      newErrors.scheduledFor = t('messageInput.schedule.errors.dateTimeRequired');
    } else if (new Date(scheduledFor) <= new Date()) {
      newErrors.scheduledFor = t('messageInput.schedule.errors.dateTimeFuture');
    }

    if (!messageContent.trim()) {
      newErrors.message = t('messageInput.schedule.errors.messageRequired');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!validate()) return;

    setIsSaving(true);
    try {
      // Backend contract note (pendência): scheduledActionsService is proven
      // with contact_id + payload.channel (see ScheduleActionModal). Whether a
      // send_message action resolves purely via conversation_id — and whether
      // payload.channel is required/honored in that path — is unverified from
      // the frontend. Flagged as a pendência, not assumed.
      const payload: CreateScheduledAction = {
        conversation_id: String(conversationId),
        action_type: 'send_message',
        scheduled_for: new Date(scheduledFor).toISOString(),
        payload: {
          channel: channelType ? CHANNEL_TYPE_MAP[channelType] : undefined,
          message: messageContent,
          note: note.trim() || undefined,
        },
        recurrence_type: 'once',
      };

      await scheduledActionsService.create(payload);
      toast.success(t('messageInput.schedule.success'));
      onClose();
    } catch (error) {
      console.error('Error scheduling message:', error);
      toast.error(t('messageInput.schedule.error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={openState => !openState && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('messageInput.schedule.title')}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('messageInput.schedule.messagePreview')}</Label>
            <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground whitespace-pre-wrap max-h-32 overflow-y-auto">
              {messageContent.trim() || t('messageInput.schedule.emptyMessage')}
            </div>
            {errors.message && <p className="text-sm text-red-500">{errors.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-datetime">{t('messageInput.schedule.dateTime')}</Label>
            <Input
              id="schedule-datetime"
              type="datetime-local"
              value={scheduledFor}
              min={getMinDateTime()}
              onChange={e => {
                setScheduledFor(e.target.value);
                if (errors.scheduledFor) setErrors({ ...errors, scheduledFor: '' });
              }}
              className={errors.scheduledFor ? 'border-red-500' : ''}
              required
            />
            {errors.scheduledFor && <p className="text-sm text-red-500">{errors.scheduledFor}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule-note">{t('messageInput.schedule.note')}</Label>
            <Textarea
              id="schedule-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              placeholder={t('messageInput.schedule.notePlaceholder')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
              {t('messageInput.schedule.cancel')}
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('messageInput.schedule.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ScheduleMessageModal;
