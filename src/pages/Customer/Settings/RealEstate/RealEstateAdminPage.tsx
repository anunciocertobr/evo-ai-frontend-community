import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { usePermissions } from '@/contexts/PermissionsContext';
import { productsService } from '@/services/products/productsService';
import { toFieldErrors } from '../Products/productErrors';
import type { Product, ProductFormData } from '@/types/products';
import RealEstateTable from '@/components/real-estate/RealEstateTable';
import RealEstateItemModal from '@/components/real-estate/RealEstateItemModal';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
} from '@evoapi/design-system';
import { Plus } from 'lucide-react';

export default function RealEstateAdminPage() {
  const { can } = usePermissions();
  const canCreate = can('products', 'create');
  const canUpdate = can('products', 'update');
  const canDelete = can('products', 'delete');

  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [confirmDelete, setConfirmDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await productsService.getProducts({ per_page: 100, item_type: 'imovel' });
      setItems(res.data ?? []);
    } catch (error) {
      console.error(error);
      toast.error('Falha ao carregar os imóveis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const openCreate = () => {
    setEditing(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const openEdit = (item: Product) => {
    setEditing(item);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleSubmit = async (payload: ProductFormData) => {
    setSaving(true);
    setFormErrors({});
    try {
      if (editing?.id) {
        await productsService.updateProduct(editing.id, payload);
        toast.success('Imóvel atualizado com sucesso');
      } else {
        await productsService.createProduct(payload);
        toast.success('Imóvel cadastrado com sucesso');
      }
      setModalOpen(false);
      setEditing(null);
      fetchItems();
    } catch (error) {
      console.error(error);
      const fieldErrors = toFieldErrors(error);
      if (Object.keys(fieldErrors).length > 0) {
        setFormErrors(fieldErrors);
      } else {
        toast.error(editing ? 'Falha ao atualizar o imóvel' : 'Falha ao cadastrar o imóvel');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await productsService.deleteProduct(confirmDelete.id);
      toast.success('Imóvel excluído com sucesso');
      setConfirmDelete(null);
      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error('Falha ao excluir o imóvel');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Imobiliária</h1>
          <p className="text-sm text-muted-foreground">
            Imóveis cadastrados aqui aparecem no site público de imóveis.
          </p>
        </div>
        <Button variant="outline" asChild>
          <a href="/imoveis" target="_blank" rel="noopener noreferrer">
            Ver site de imóveis
          </a>
        </Button>
      </div>

      <div className="flex items-center justify-end mb-4">
        <Button onClick={openCreate} disabled={!canCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          Novo Imóvel
        </Button>
      </div>

      {loading ? (
        <div className="text-center text-sm text-muted-foreground py-10">Carregando...</div>
      ) : (
        <RealEstateTable
          items={items}
          canUpdate={canUpdate}
          canDelete={canDelete}
          onEdit={openEdit}
          onDelete={(item) => setConfirmDelete(item)}
        />
      )}

      <RealEstateItemModal
        open={modalOpen}
        item={editing}
        loading={saving}
        errors={formErrors}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <Dialog open={Boolean(confirmDelete)} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir imóvel</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir "{confirmDelete?.name}"? Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={deleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete} disabled={deleting}>
              {deleting ? 'Excluindo...' : 'Excluir'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
