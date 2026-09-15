import apiPublic from '@/services/core/apiPublic';
import type { ProductMedia } from '@/types/products/product';

export interface PublicRealEstateListing {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  media: ProductMedia[];
  tags?: string[] | null;
  estado?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  endereco?: string | null;
  numero?: string | null;
  cep?: string | null;
  quartos?: number | null;
  banheiros?: number | null;
  vagas?: number | null;
  suites?: number | null;
  perto_metro?: boolean | null;
  condominio?: number | null;
  iptu?: number | null;
  vantagens?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PublicRealEstateSettings {
  company_name: string | null;
  header_color: string | null;
  background_color: string | null;
  footer_color: string | null;
  icon_color: string | null;
  text_color: string | null;
  title_color: string | null;
  company_name_color: string | null;
  gtm_id: string | null;
  whatsapp_number: string | null;
}

export interface PublicRealEstate {
  listings: PublicRealEstateListing[];
  settings: PublicRealEstateSettings;
}

/**
 * Service para a API pública (anônima) do site de imóveis.
 * Endpoint: GET /public/api/v1/real_estate. Não requer autenticação — lista
 * os imóveis (Product com item_type "imovel") ativos; filtro por tag/estado/
 * cidade é feito no cliente a partir da lista completa.
 */
class RealEstateService {
  async getListings(): Promise<PublicRealEstate> {
    const { data } = await apiPublic.get<{ data: PublicRealEstate }>('/real_estate');
    return data.data;
  }
}

export const realEstateService = new RealEstateService();
export default realEstateService;
