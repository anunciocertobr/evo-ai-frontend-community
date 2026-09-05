export type SocialChannelType = 'Channel::Instagram' | 'Channel::FacebookPage';

export interface SocialChannelOption {
  channel_type: SocialChannelType;
  channel_id: string;
  username: string;
  page_id?: string;
}

export interface InstagramAccountInfo {
  username: string;
  followers_count: number;
  media_count: number;
  follows_count?: number;
  biography?: string;
  profile_picture_url?: string;
  website?: string;
}

export interface InstagramMediaInsight {
  name: string;
  values?: { value: number }[];
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
  insights?: { data: InstagramMediaInsight[] };
}

export interface InstagramStory {
  id: string;
  media_type: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  timestamp?: string;
}

export interface InstagramComment {
  id: string;
  text: string;
  username?: string;
  timestamp?: string;
  like_count?: number;
  from?: { username?: string };
}

export type PublicationPlatform = 'instagram' | 'facebook';
export type PublicationContentType = 'feed' | 'stories' | 'reels';
export type PublicationStatus = 'pending' | 'publishing' | 'published' | 'failed';

export interface Publication {
  id: string;
  caption?: string;
  platforms: PublicationPlatform[];
  content_type: PublicationContentType;
  status: PublicationStatus;
  error_message?: string;
  external_post_ids: Record<string, string>;
  created_at: string;
}

export interface CreatePublicationPayload {
  caption: string;
  platforms: PublicationPlatform[];
  content_type: PublicationContentType;
  media: File;
  thumbnail?: File;
  channel_type: SocialChannelType;
  channel_id: string;
}

export type CarouselBatchStatus = 'collecting' | 'publishing' | 'published' | 'failed' | 'abandoned';

export interface CarouselBatch {
  id: string;
  caption?: string;
  platforms: PublicationPlatform[];
  total_cards: number;
  status: CarouselBatchStatus;
  error_message?: string;
  external_post_ids: Record<string, string>;
  cards_collected: Record<string, number>;
  created_at: string;
}

export interface CreateCarouselBatchPayload {
  caption: string;
  platforms: PublicationPlatform[];
  total_cards: number;
  channel_type: SocialChannelType;
  channel_id: string;
}

export type ScheduledPostStatus = 'scheduled' | 'executing' | 'completed' | 'failed' | 'cancelled';

export interface ScheduledPostItem {
  id: string;
  caption?: string;
  platforms: PublicationPlatform[];
  content_type: PublicationContentType;
  status: ScheduledPostStatus;
  error_message?: string;
  external_post_ids: Record<string, string>;
  scheduled_for: string;
  retry_count: number;
  max_retries: number;
  created_at: string;
}

export interface CreateScheduledPostPayload {
  caption: string;
  platforms: PublicationPlatform[];
  content_type: PublicationContentType;
  media: File;
  thumbnail?: File;
  channel_type: SocialChannelType;
  channel_id: string;
  scheduled_for: string;
}

export type WhatsappStatusType = 'text' | 'image' | 'video' | 'audio';

export interface WhatsappStatusChannelOption {
  channel_id: string;
  name: string;
}

export interface CreateWhatsappStatusPayload {
  channel_id: string;
  type: WhatsappStatusType;
  content?: string;
  media?: File;
  caption?: string;
}

export type YoutubePrivacyStatus = 'public' | 'unlisted' | 'private';
export type YoutubeUploadStatus = 'pending' | 'uploading' | 'published' | 'failed';

export interface YoutubeUploadItem {
  id: string;
  title: string;
  description?: string;
  privacy_status: YoutubePrivacyStatus;
  status: YoutubeUploadStatus;
  error_message?: string;
  external_video_id?: string;
  created_at: string;
}

export interface CreateYoutubeUploadPayload {
  title: string;
  description: string;
  privacy_status: YoutubePrivacyStatus;
  video: File;
}

export interface FacebookAccountInfo {
  name?: string;
  fan_count?: number;
  picture?: { data?: { url?: string } };
  link?: string;
  about?: string;
}

export interface FacebookPostAttachment {
  media_type?: string;
  media?: { image?: { src?: string } };
  url?: string;
}

export interface FacebookPost {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data: FacebookPostAttachment[] };
  likes?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
}

export interface FacebookAccessiblePage {
  page_id: string;
  name: string;
  instagram?: { id: string; username?: string; profile_picture_url?: string } | null;
  connected: boolean;
}

export interface FacebookStory {
  post_id?: string;
  status?: string;
  creation_time?: number;
  media_type?: string;
  media_id?: string;
  url?: string;
  media_url?: string | null;
}

export interface YoutubeChannelInfo {
  snippet?: { title?: string; description?: string; thumbnails?: { default?: { url?: string } } };
  statistics?: { subscriberCount?: string; videoCount?: string; viewCount?: string };
}

export interface YoutubeVideoItem {
  id?: string;
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: { medium?: { url?: string }; high?: { url?: string }; default?: { url?: string } };
  };
  contentDetails?: { videoId?: string };
  statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
}
