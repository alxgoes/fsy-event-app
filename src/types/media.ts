export interface MediaPhoto {
  id: string;
  title: string;
  drive_url: string;
  thumbnail_url: string | null;
  category: string;
  visible: boolean;
  created_at: string;
}
