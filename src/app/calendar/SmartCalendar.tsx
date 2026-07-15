import React from 'react';
import { createClient } from '@/utils/supabase/server';
import CalendarViewToggle from './CalendarViewToggle';

export default async function SmartCalendar() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return null;

  // Fetch events with plant and product names
  const { data: events } = await supabase.from('events').select('*, plants(name, species), products(name)').order('date', { ascending: false }).limit(50);

  // No AI recommendations, just manual events
  return <CalendarViewToggle recommendations={[]} events={events || []} />;
}
