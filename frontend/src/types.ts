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
