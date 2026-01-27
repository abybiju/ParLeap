import { create } from 'zustand';
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/types';

type Event = Database['public']['Tables']['events']['Row'];
type EventItem = Database['public']['Tables']['event_items']['Row'];

interface EventWithItems extends Event {
  items?: EventItem[];
}

interface EventsState {
  events: Event[];
  currentEvent: EventWithItems | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchEvents: () => Promise<void>;
  fetchEventById: (id: string) => Promise<EventWithItems | null>;
  createEvent: (eventData: Omit<Event, 'id' | 'created_at' | 'updated_at'>) => Promise<Event | null>;
  updateEvent: (id: string, updates: Partial<Omit<Event, 'id' | 'created_at' | 'updated_at'>>) => Promise<Event | null>;
  deleteEvent: (id: string) => Promise<boolean>;
  setCurrentEvent: (event: EventWithItems | null) => void;
  clearError: () => void;
}

export const useEventsStore = create<EventsState>((set, get) => ({
  events: [],
  currentEvent: null,
  loading: false,
  error: null,

  fetchEvents: async () => {
    set({ loading: true, error: null });
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, error: 'Not authenticated' });
      return;
    }

    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('user_id', user.id)
      .order('event_date', { ascending: true, nullsFirst: false });

    if (error) {
      set({ loading: false, error: error.message, events: [] });
      return;
    }

    set({ loading: false, error: null, events: data || [] });
  },

  fetchEventById: async (id) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, error: 'Not authenticated' });
      return null;
    }

    // Fetch event
    const { data: event, error: eventError } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single();

    if (eventError || !event) {
      set({ loading: false, error: eventError?.message || 'Event not found' });
      return null;
    }

    // Fetch event items (setlist)
    const { data: items, error: itemsError } = await supabase
      .from('event_items')
      .select('*')
      .eq('event_id', id)
      .order('sequence_order', { ascending: true });

    const eventWithItems: EventWithItems = {
      ...event,
      items: items || [],
    };

    set({ loading: false, error: itemsError?.message || null, currentEvent: eventWithItems });
    return eventWithItems;
  },

  createEvent: async (eventData) => {
    set({ loading: true, error: null });
    const supabase = createClient();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      set({ loading: false, error: 'Not authenticated' });
      return null;
    }

    const { data, error } = await supabase
      .from('events')
      .insert({
        ...eventData,
        user_id: user.id,
      })
      .select()
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }

    // Update local state
    const currentEvents = get().events;
    set({ 
      loading: false, 
      error: null, 
      events: [...currentEvents, data]
    });

    return data;
  },

  updateEvent: async (id, updates) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { data, error } = await supabase
      .from('events')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      set({ loading: false, error: error.message });
      return null;
    }

    // Update local state
    const currentEvents = get().events;
    const updatedEvents = currentEvents.map(event => event.id === id ? data : event);
    
    // Update currentEvent if it's the one being updated
    const currentEvent = get().currentEvent;
    const updatedCurrentEvent = currentEvent && currentEvent.id === id 
      ? { ...currentEvent, ...data }
      : currentEvent;

    set({ 
      loading: false, 
      error: null, 
      events: updatedEvents,
      currentEvent: updatedCurrentEvent,
    });

    return data;
  },

  deleteEvent: async (id) => {
    set({ loading: true, error: null });
    const supabase = createClient();

    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id);

    if (error) {
      set({ loading: false, error: error.message });
      return false;
    }

    // Update local state
    const currentEvents = get().events;
    const updatedEvents = currentEvents.filter(event => event.id !== id);
    
    // Clear currentEvent if it's the one being deleted
    const currentEvent = get().currentEvent;
    const updatedCurrentEvent = currentEvent && currentEvent.id === id ? null : currentEvent;

    set({ 
      loading: false, 
      error: null, 
      events: updatedEvents,
      currentEvent: updatedCurrentEvent,
    });

    return true;
  },

  setCurrentEvent: (event) => {
    set({ currentEvent: event });
  },

  clearError: () => {
    set({ error: null });
  },
}));
