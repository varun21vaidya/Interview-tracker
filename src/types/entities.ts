export type Result = 'pending' | 'approved' | 'rejected' | 'didnt_happen';
export type Channel = 'mark' | 'copy' | 'mail';

export interface Company {
  id: string; name: string; role?: string; status: 'active' | 'rejected';
  rejectedReason?: 'round' | 'not_moving_forward'; rejectedAfterRound?: number;
  jdPreview?: string; jdWords?: number; jdLink?: string; notes?: string;
}
export interface Recruiter { companyId: string; name?: string; phone?: string; email?: string }
export interface Round {
  id: string; companyId: string; source: 'manual' | 'calendar'; calendarEventId?: string;
  type: 'walk_in' | 'offline' | 'phone' | 'online'; label: string;
  startsAt: number; endsAt?: number; orderAt: number;
  result: Result; changeFlag?: 'moved' | 'cancelled'; autoAddedAt?: number;
}
export interface RecruiterCall { id: string; companyId: string; callAt: number; recruiterName?: string; said?: string }
export interface Ping { id: string; companyId: string; targetType: 'round' | 'recruiter_call'; targetId: string; pingedAt: number; channel: Channel }
export interface Alias { type: 'organizer' | 'title'; pattern: string; companyId: string }
export interface CalEvent {
  eventId: string; calendarId: string; title: string; startsAt: number; endsAt?: number;
  organizerEmail?: string; meetingLink?: string; phone?: string;
}
export interface Bundle { company: Company; recruiter?: Recruiter; rounds: Round[]; calls: RecruiterCall[]; pings: Ping[] }
