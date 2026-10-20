export interface CounselorAuditLog {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  company_id: string | null;
  company_name: string | null;
  action_type: string;
  action_label: string;
  title: string | null;
  content: string;
  details: Record<string, unknown> | null;
  created_at: string;
}
