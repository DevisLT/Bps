export interface User {
  id: number;
  username: string;
  battery_level: number;
  energy_shared: number;
  energy_received: number;
  is_online: boolean;
}

export interface Session {
  id: number;
  sender_id: number;
  receiver_id: number;
  amount: number;
  status: 'pending' | 'active' | 'completed' | 'failed';
  created_at: string;
  sender?: string;
  receiver?: string;
}

export interface NearbyUser {
  id: number;
  username: string;
  battery_level: number;
}
