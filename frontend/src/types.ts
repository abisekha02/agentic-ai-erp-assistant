export type Role = "admin" | "employee";
export interface User { id: number; username: string; email: string; first_name: string; role: Role }

export interface Source {
  ref: number; document_id: number; document: string; location: string; snippet: string; similarity: number;
}
export interface LeavePayload { leave_type: string; start_date: string; end_date: string; days: number; reason: string }
export interface PendingAction {
  id: number; action_type: string; payload: LeavePayload; summary: string;
  status: "pending" | "executed" | "rejected" | "failed"; result: string;
}
export interface Msg {
  id: number; role: "user" | "assistant"; content: string; sources: Source[];
  feedback: 1 | -1 | null; action: PendingAction | null; created_at: string;
}
export interface Conversation { id: number; title: string; updated_at: string }
export interface Doc {
  id: number; title: string; original_name: string; file_type: string; access_level: "all" | "admin";
  status: "processing" | "ready" | "failed"; error: string; page_count: number; chunk_count: number;
  uploaded_by: string | null; created_at: string;
}

export interface Stats {
  documents: { total: number; ready: number; admin_only: number };
  conversations: number;
  questions_7d: number; questions_change_pct: number | null;
  not_found_rate: number | null; questions_total: number;
  helpful_rate: number | null; rated: number;
  avg_latency_s: number | null; leave_requests: number;
  daily: { date: string; count: number }[];
  top_documents: { document: string; count: number }[];
  downvoted: { id: number; user: string; question: string; answer: string; comment: string }[];
}

export interface LeaveReq {
  id: number; employee: string; employee_name: string; leave_type: string; start_date: string; end_date: string;
  days: number; reason: string; status: "submitted" | "approved" | "rejected"; created_at: string;
  decided_by: string | null; decided_at: string | null; decision_note: string;
}
export interface Balance { annual_total: number; taken: number; pending: number; remaining: number }
