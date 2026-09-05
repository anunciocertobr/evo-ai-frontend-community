import api from '@/services/core/api';
import { extractData } from '@/utils/apiHelpers';
import type {
  SocialChannelOption,
  SocialChannelType,
  InstagramAccountInfo,
  InstagramMedia,
  InstagramStory,
  InstagramComment,
  Publication,
  CreatePublicationPayload,
  CarouselBatch,
  CreateCarouselBatchPayload,
  ScheduledPostItem,
  CreateScheduledPostPayload,
  WhatsappStatusChannelOption,
  CreateWhatsappStatusPayload,
  YoutubeUploadItem,
  CreateYoutubeUploadPayload,
  FacebookAccountInfo,
  FacebookPost,
  FacebookAccessiblePage,
  FacebookStory,
  BusinessLocation,
  BusinessLocationDetail,
  BusinessCategory,
  BusinessLocalPost,
  CreateBusinessPostPayload,
  YoutubeChannelInfo,
  YoutubeVideoItem,
} from '@/types/marketing/gestorPosts';

class GestorPostsService {
  private readonly baseUrl = '/gestor_posts';

  async getChannels(): Promise<SocialChannelOption[]> {
    const response = await api.get(`${this.baseUrl}/channels`);
    return extractData<SocialChannelOption[]>(response);
  }

  async getFacebookChannels(): Promise<SocialChannelOption[]> {
    const response = await api.get(`${this.baseUrl}/facebook_channels`);
    return extractData<SocialChannelOption[]>(response);
  }

  async getAccessibleFacebookPages(): Promise<FacebookAccessiblePage[]> {
    const response = await api.get(`${this.baseUrl}/facebook_pages/accessible`);
    return extractData<FacebookAccessiblePage[]>(response);
  }

  async connectFacebookPage(pageId: string): Promise<SocialChannelOption> {
    const response = await api.post(`${this.baseUrl}/facebook_pages/connect`, { page_id: pageId });
    return extractData<SocialChannelOption>(response);
  }

  async getAccountInfo(channel?: SocialChannelOption): Promise<InstagramAccountInfo> {
    const response = await api.get(`${this.baseUrl}/gallery/account_info`, { params: channelParams(channel) });
    return extractData<InstagramAccountInfo>(response);
  }

  async getMedia(channel?: SocialChannelOption, limit = 25): Promise<InstagramMedia[]> {
    const response = await api.get(`${this.baseUrl}/gallery/media`, { params: { ...channelParams(channel), limit } });
    return extractData<InstagramMedia[]>(response);
  }

  async getStories(channel?: SocialChannelOption): Promise<InstagramStory[]> {
    const response = await api.get(`${this.baseUrl}/gallery/stories`, { params: channelParams(channel) });
    return extractData<InstagramStory[]>(response);
  }

  async deleteMedia(mediaId: string, channel?: SocialChannelOption): Promise<void> {
    await api.delete(`${this.baseUrl}/gallery/media/${mediaId}`, { params: channelParams(channel) });
  }

  async getComments(postId: string, channel?: SocialChannelOption): Promise<InstagramComment[]> {
    const response = await api.get(`${this.baseUrl}/comments`, { params: { ...channelParams(channel), post_id: postId } });
    return extractData<InstagramComment[]>(response);
  }

  async replyComment(commentId: string, text: string, channel?: SocialChannelOption): Promise<unknown> {
    const response = await api.post(`${this.baseUrl}/comments/reply`, { ...channelParams(channel), comment_id: commentId, text });
    return extractData<unknown>(response);
  }

  async getPublications(): Promise<Publication[]> {
    const response = await api.get(`${this.baseUrl}/publications`);
    return extractData<Publication[]>(response);
  }

  async getPublication(id: string): Promise<Publication> {
    const response = await api.get(`${this.baseUrl}/publications/${id}`);
    return extractData<Publication>(response);
  }

  async createPublication(payload: CreatePublicationPayload): Promise<{ id: string; status: string }> {
    const formData = new FormData();
    formData.append('caption', payload.caption);
    formData.append('content_type', payload.content_type);
    formData.append('channel_type', payload.channel_type);
    formData.append('channel_id', payload.channel_id);
    payload.platforms.forEach((p) => formData.append('platforms[]', p));
    formData.append('media', payload.media);
    if (payload.thumbnail) formData.append('thumb', payload.thumbnail);

    const response = await api.post(`${this.baseUrl}/publications`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<{ id: string; status: string }>(response);
  }

  async createCarouselBatch(payload: CreateCarouselBatchPayload): Promise<CarouselBatch> {
    const response = await api.post(`${this.baseUrl}/carousel_uploads`, payload);
    return extractData<CarouselBatch>(response);
  }

  async getCarouselBatch(id: string): Promise<CarouselBatch> {
    const response = await api.get(`${this.baseUrl}/carousel_uploads/${id}`);
    return extractData<CarouselBatch>(response);
  }

  async addCarouselCard(batchId: string, media: File): Promise<CarouselBatch> {
    const formData = new FormData();
    formData.append('media', media);
    const response = await api.post(`${this.baseUrl}/carousel_uploads/${batchId}/cards`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<CarouselBatch>(response);
  }

  async getScheduledPosts(): Promise<ScheduledPostItem[]> {
    const response = await api.get(`${this.baseUrl}/scheduled_posts`);
    return extractData<ScheduledPostItem[]>(response);
  }

  async createScheduledPost(payload: CreateScheduledPostPayload): Promise<ScheduledPostItem> {
    const formData = new FormData();
    formData.append('caption', payload.caption);
    formData.append('content_type', payload.content_type);
    formData.append('channel_type', payload.channel_type);
    formData.append('channel_id', payload.channel_id);
    formData.append('scheduled_for', payload.scheduled_for);
    payload.platforms.forEach((p) => formData.append('platforms[]', p));
    formData.append('media', payload.media);
    if (payload.thumbnail) formData.append('thumb', payload.thumbnail);

    const response = await api.post(`${this.baseUrl}/scheduled_posts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<ScheduledPostItem>(response);
  }

  async cancelScheduledPost(id: string): Promise<ScheduledPostItem> {
    const response = await api.post(`${this.baseUrl}/scheduled_posts/${id}/cancel`);
    return extractData<ScheduledPostItem>(response);
  }

  async retryScheduledPost(id: string): Promise<ScheduledPostItem> {
    const response = await api.post(`${this.baseUrl}/scheduled_posts/${id}/retry`);
    return extractData<ScheduledPostItem>(response);
  }

  async getWhatsappStatusChannels(): Promise<WhatsappStatusChannelOption[]> {
    const response = await api.get(`${this.baseUrl}/whatsapp_status/channels`);
    return extractData<WhatsappStatusChannelOption[]>(response);
  }

  async createWhatsappStatus(payload: CreateWhatsappStatusPayload): Promise<{ id: string }> {
    const formData = new FormData();
    formData.append('channel_id', payload.channel_id);
    formData.append('type', payload.type);
    if (payload.content) formData.append('content', payload.content);
    if (payload.media) formData.append('media', payload.media);
    if (payload.caption) formData.append('caption', payload.caption);

    const response = await api.post(`${this.baseUrl}/whatsapp_status`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<{ id: string }>(response);
  }

  async getYoutubeConnected(): Promise<boolean> {
    const response = await api.get(`${this.baseUrl}/youtube/connected`);
    return extractData<{ connected: boolean }>(response).connected;
  }

  async createYoutubeUpload(payload: CreateYoutubeUploadPayload): Promise<YoutubeUploadItem> {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('description', payload.description);
    formData.append('privacy_status', payload.privacy_status);
    formData.append('video', payload.video);

    const response = await api.post(`${this.baseUrl}/youtube`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<YoutubeUploadItem>(response);
  }

  async getYoutubeUpload(id: string): Promise<YoutubeUploadItem> {
    const response = await api.get(`${this.baseUrl}/youtube/${id}`);
    return extractData<YoutubeUploadItem>(response);
  }

  async getFacebookAccountInfo(channel: SocialChannelOption): Promise<FacebookAccountInfo> {
    const response = await api.get(`${this.baseUrl}/gallery/facebook_account_info`, { params: channelParams(channel) });
    return extractData<FacebookAccountInfo>(response);
  }

  async getFacebookMedia(channel: SocialChannelOption, limit = 25): Promise<FacebookPost[]> {
    const response = await api.get(`${this.baseUrl}/gallery/facebook_media`, { params: { ...channelParams(channel), limit } });
    return extractData<FacebookPost[]>(response);
  }

  async getFacebookStories(channel?: SocialChannelOption): Promise<FacebookStory[]> {
    const response = await api.get(`${this.baseUrl}/gallery/facebook_stories`, { params: channelParams(channel) });
    return extractData<FacebookStory[]>(response);
  }

  async deleteFacebookMedia(postId: string, channel?: SocialChannelOption): Promise<void> {
    await api.delete(`${this.baseUrl}/gallery/facebook_media/${postId}`, { params: channelParams(channel) });
  }

  async getYoutubeAccountInfo(): Promise<YoutubeChannelInfo> {
    const response = await api.get(`${this.baseUrl}/youtube/account_info`);
    return extractData<YoutubeChannelInfo>(response);
  }

  async getYoutubeVideos(limit = 25): Promise<YoutubeVideoItem[]> {
    const response = await api.get(`${this.baseUrl}/youtube/videos`, { params: { limit } });
    return extractData<YoutubeVideoItem[]>(response);
  }

  async getBusinessProfileConnected(): Promise<boolean> {
    const response = await api.get(`${this.baseUrl}/business_profile/connected`);
    return extractData<{ connected: boolean }>(response).connected;
  }

  async getBusinessLocations(): Promise<BusinessLocation[]> {
    const response = await api.get(`${this.baseUrl}/business_profile/locations`);
    return extractData<BusinessLocation[]>(response);
  }

  async getBusinessLocation(locationName: string): Promise<BusinessLocationDetail> {
    const response = await api.get(`${this.baseUrl}/business_profile/location`, { params: { location_name: locationName } });
    return extractData<BusinessLocationDetail>(response);
  }

  async updateBusinessLocation(
    locationName: string,
    fields: Record<string, unknown>,
    updateMask: string[],
  ): Promise<BusinessLocationDetail> {
    const response = await api.patch(`${this.baseUrl}/business_profile/location`, {
      location_name: locationName,
      fields,
      update_mask: updateMask,
    });
    return extractData<BusinessLocationDetail>(response);
  }

  async getBusinessCategories(query: string): Promise<BusinessCategory[]> {
    const response = await api.get(`${this.baseUrl}/business_profile/categories`, { params: { query } });
    return extractData<BusinessCategory[]>(response);
  }

  async getBusinessPosts(accountName: string, locationId: string): Promise<BusinessLocalPost[]> {
    const response = await api.get(`${this.baseUrl}/business_profile/posts`, {
      params: { account_name: accountName, location_id: locationId },
    });
    return extractData<BusinessLocalPost[]>(response);
  }

  async createBusinessPost(payload: CreateBusinessPostPayload): Promise<{ id: string; status: string }> {
    const formData = new FormData();
    formData.append('media', payload.media);
    formData.append('summary', payload.summary);
    formData.append('account_name', payload.account_name);
    formData.append('location_id', payload.location_id);
    if (payload.location_title) formData.append('location_title', payload.location_title);
    if (payload.cta_action_type) formData.append('cta_action_type', payload.cta_action_type);
    if (payload.cta_url) formData.append('cta_url', payload.cta_url);

    const response = await api.post(`${this.baseUrl}/business_profile/posts`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return extractData<{ id: string; status: string }>(response);
  }

  async deleteBusinessPost(postName: string): Promise<void> {
    await api.delete(`${this.baseUrl}/business_profile/posts`, { params: { post_name: postName } });
  }
}

function channelParams(channel?: SocialChannelOption): { channel_type?: SocialChannelType; channel_id?: string } {
  if (!channel) return {};
  return { channel_type: channel.channel_type, channel_id: channel.channel_id };
}

export const gestorPostsService = new GestorPostsService();
