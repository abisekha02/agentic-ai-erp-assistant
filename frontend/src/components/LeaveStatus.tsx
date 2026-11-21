import type { LeaveReq } from "../types";

const STYLE: Record<LeaveReq["status"], string> = {
  submitted: "bg-[#FFF1E0] text-[#C26A12]",
  approved: "bg-[#DFF4F0] text-[#1B8F7E]",
  rejected: "bg-[#FDE6EB] text-[#D83B5E]",
};
const LABEL: Record<LeaveReq["status"], string> = { submitted: "Awaiting approval", approved: "Approved", rejected: "Rejected" };

export default function LeaveStatus({ status }: { status: LeaveReq["status"] }) {
  return <span className={`whitespace-nowrap rounded-md px-2.5 py-1 text-xs font-semibold ${STYLE[status]}`}>{LABEL[status]}</span>;
}

export const dateRange = (r: LeaveReq) => (r.start_date === r.end_date ? r.start_date : `${r.start_date} to ${r.end_date}`);
