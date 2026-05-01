import React, { useState } from 'react';
import { 
  format, addMonths, subMonths, startOfMonth, endOfMonth, 
  startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays, 
  eachDayOfInterval, isToday 
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

const DS = {
  bg: '#0f172a',
  card: '#131b2e',
  border: 'rgba(14,165,233,0.1)',
  primary: '#0ea5e9',
  text: '#dae2fd',
  muted: '#88929b',
  surface: '#0b1326',
};

export interface CalendarEvent {
  id: string;
  date: Date;
  title: string;
  type: 'leave' | 'subscription' | 'ticket' | 'deployment';
  color?: string;
  originalData?: any;
}

interface CalendarViewProps {
  events: CalendarEvent[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: CalendarEvent) => void;
}

export const CalendarView: React.FC<CalendarViewProps> = ({ events, onDateClick, onEventClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const renderHeader = () => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: DS.text, display: 'flex', alignItems: 'center', gap: '10px' }}>
        <CalendarIcon size={20} color={DS.primary} />
        {format(currentMonth, 'MMMM yyyy')}
      </h3>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button 
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          style={{ padding: '8px', borderRadius: '8px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, cursor: 'pointer' }}
        >
          <ChevronLeft size={18} />
        </button>
        <button 
          onClick={() => setCurrentMonth(new Date())}
          style={{ padding: '8px 12px', borderRadius: '8px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}
        >
          Today
        </button>
        <button 
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          style={{ padding: '8px', borderRadius: '8px', background: DS.surface, border: `1px solid ${DS.border}`, color: DS.text, cursor: 'pointer' }}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );

  const renderDays = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '10px' }}>
        {days.map(day => (
          <div key={day} style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 800, color: DS.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {day}
          </div>
        ))}
      </div>
    );
  };

  const renderCells = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const interval = eachDayOfInterval({ start: startDate, end: endDate });

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: DS.border, borderRadius: '12px', overflow: 'hidden', border: `1px solid ${DS.border}` }}>
        {interval.map((day, i) => {
          const dayEvents = events.filter(event => isSameDay(event.date, day));
          const isSelected = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);

          return (
            <div 
              key={i} 
              onClick={() => onDateClick?.(day)}
              style={{ 
                minHeight: '100px', 
                background: isSelected ? DS.card : 'rgba(15,23,42,0.5)', 
                padding: '8px',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.background = DS.surface}
              onMouseLeave={e => e.currentTarget.style.background = isSelected ? DS.card : 'rgba(15,23,42,0.5)'}
            >
              <span style={{ 
                fontSize: '0.75rem', 
                fontWeight: isTodayDate ? 800 : 600, 
                color: isTodayDate ? DS.primary : (isSelected ? DS.text : DS.muted),
                display: 'block',
                marginBottom: '6px'
              }}>
                {format(day, 'd')}
              </span>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {dayEvents.slice(0, 3).map(event => (
                  <div 
                    key={event.id}
                    onClick={(e) => { e.stopPropagation(); onEventClick?.(event); }}
                    style={{ 
                      fontSize: '0.65rem', 
                      padding: '4px 6px', 
                      borderRadius: '4px', 
                      background: event.color || 'rgba(14,165,233,0.1)', 
                      color: '#fff',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 700,
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <span style={{ fontSize: '0.6rem', color: DS.muted, fontWeight: 700, marginLeft: '4px' }}>
                    +{dayEvents.length - 3} more
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ width: '100%', background: DS.card, borderRadius: '24px', border: `1px solid ${DS.border}`, padding: '24px' }}>
      {renderHeader()}
      {renderDays()}
      {renderCells()}
    </div>
  );
};

export const MiniCalendar: React.FC<CalendarViewProps> = ({ events, onDateClick, onEventClick }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);
  const interval = eachDayOfInterval({ start: startDate, end: endDate });

  return (
    <div style={{ background: DS.card, borderRadius: '20px', border: `1px solid ${DS.border}`, padding: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', padding: '0 4px' }}>
        <h4 style={{ fontSize: '0.75rem', fontWeight: 800, color: DS.text, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{format(currentMonth, 'MMM yyyy')}</h4>
        <div style={{ display: 'flex', gap: '2px' }}>
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ padding: '4px', background: 'transparent', border: 'none', color: DS.muted, cursor: 'pointer' }}><ChevronLeft size={12} /></button>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ padding: '4px', background: 'transparent', border: 'none', color: DS.muted, cursor: 'pointer' }}><ChevronRight size={12} /></button>
        </div>
      </div>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: '0.55rem', fontWeight: 800, color: DS.muted, marginBottom: '4px' }}>{d}</div>
        ))}
        {interval.map((day, i) => {
          const isSelected = isSameMonth(day, monthStart);
          const isTodayDate = isToday(day);
          const dayEvents = events.filter(e => isSameDay(e.date, day));

          return (
            <div 
              key={i} 
              onClick={() => onDateClick?.(day)}
              style={{ 
                aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                borderRadius: '6px', cursor: 'pointer', 
                border: isTodayDate ? `1px solid ${DS.primary}` : '1px solid transparent',
                background: isTodayDate ? 'rgba(14,165,233,0.05)' : 'transparent',
                opacity: isSelected ? 1 : 0.2
              }}
            >
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: isTodayDate ? DS.primary : DS.text }}>{format(day, 'd')}</span>
              <div style={{ display: 'flex', gap: '1.5px', marginTop: '1.5px' }}>
                {dayEvents.slice(0, 3).map((e, idx) => (
                  <div key={idx} style={{ width: '3px', height: '3px', borderRadius: '50%', background: e.color || '#fff' }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
