'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

export function ReplyDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  onSubmit: (body: string) => Promise<void>;
}) {
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!body.trim()) return;
    try {
      setSaving(true);
      await onSubmit(body.trim());
      setBody('');
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Responder consulta</DialogTitle>
        </DialogHeader>
        <Textarea rows={5} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Escribe tu respuesta..." />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            Enviar respuesta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
